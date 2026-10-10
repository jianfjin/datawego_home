/**
 * Guard tests for POST /api/contact (functions/api/contact.js).
 *
 * Dependency-free on purpose: plain node --test, a stubbed global fetch, and a
 * fake KV binding. Run with `node --test` from the repository root.
 */

import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import { onRequestPost } from "../functions/api/contact.js";
import {
  CONTACT_RECIPIENT,
  MAX_EMAIL_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_ORG_LENGTH,
  MIN_MESSAGE_LENGTH,
  MIN_NAME_LENGTH,
  NEED_OPTIONS,
  SUBJECT_PREFIX,
} from "../functions/api/_contact.js";

const PAGE_ORIGIN = "https://www.datawego.nl";
const ENDPOINT = `${PAGE_ORIGIN}/api/contact`;
const RESEND = "https://api.resend.com/emails";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function validPayload(overrides = {}) {
  return {
    name: "Ana Ruiz",
    email: "Ana@Clinic-Example.com",
    org: "Clinic Nine",
    need: "Data platform",
    message: "We need to unify three EHR extracts into one reporting decision.",
    turnstileToken: ".skip-token-abcdefghijklmnop",
    submissionId: "11111111-1111-4111-8111-111111111111",
    website: "",
    ...overrides,
  };
}

function request(payload, { origin = PAGE_ORIGIN, url = ENDPOINT, headers } = {}) {
  const h = new Headers(headers ?? {});
  if (!h.get("Content-Type")) h.set("Content-Type", "application/json");
  if (!h.get("CF-Connecting-IP")) h.set("CF-Connecting-IP", "203.0.113.7");
  if (origin !== null) h.set("Origin", origin);
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return new Request(url, { method: "POST", headers: h, body });
}

function kvBinding() {
  const store = new Map();
  return {
    store,
    async get(key) {
      const hit = store.get(key);
      if (hit === undefined) return null;
      if (hit.expiresAt !== null && hit.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return hit.value;
    },
    async put(key, value, options = {}) {
      store.set(key, {
        value,
        expiresAt: options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null,
      });
    },
  };
}

/**
 * Stub the two networks the Function talks to, and record what it sent.
 * `reply` and `siteverifyStatus` steer the confirmation, `resendStatus` steers the
 * provider, and `throwOn` names whichever of the two is having an outage.
 */
function stubNetwork({ reply, resendStatus = 200, siteverifyStatus = 200, throwOn = [] } = {}) {
  const calls = { siteverify: [], resend: [] };
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === SITEVERIFY) {
      calls.siteverify.push({ form: new URLSearchParams(init.body ?? ""), headers: init.headers });
      if (throwOn.includes("siteverify")) throw new Error("siteverify could not be reached");
      const result = await (typeof reply === "function" ? reply() : reply ?? { success: true, hostname: "www.datawego.nl" });
      return jsonResponse(siteverifyStatus, result);
    }
    if (url === RESEND) {
      calls.resend.push({ body: JSON.parse(init.body), headers: new Headers(init.headers ?? {}) });
      if (throwOn.includes("resend")) throw new Error("resend could not be reached");
      return resendStatus === 200
        ? jsonResponse(200, { id: "email_1" })
        : jsonResponse(resendStatus, { statusCode: String(resendStatus), name: "validation_error", message: "rejected" });
    }
    throw new Error(`unexpected fetch to ${url}`);
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

/** The throttle's own worst day: every read throws. */
function unavailableKv() {
  return {
    async get() {
      throw new Error("kv is having a bad day");
    },
    async put() {
      throw new Error("kv is having a bad day");
    },
  };
}

/** An HTML attribute value, as the browser would hand it to a script. */
function decodeEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function env(overrides = {}) {
  return {
    TURNSTILE_SECRET: "1x0000000000000000000000000000000AA",
    RESEND_API_KEY: "re_test_key",
    CONTACT_FROM: "DataWeGo Website <info@datawego.nl>",
    CONTACT_RATE_LIMIT: kvBinding(),
    ...overrides,
  };
}

async function send(payload, { context = {}, ... requestOptions } = {}) {
  const network = stubNetwork({
    ...(context.network ?? {}),
    ...(context.reply === undefined ? {} : { reply: context.reply }),
  });
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => {
    logs.push(args.map(String).join(" "));
  };
  try {
    const response = await onRequestPost({
      request: request(payload, requestOptions),
      env: env(context.env),
      waitUntil() {},
      next: async () => Response.error(),
    });
    return { response, calls: network.calls, logs };
  } finally {
    console.error = originalError;
    network.restore();
  }
}

async function jsonOf(response) {
  return response.json();
}

test("a valid submission is delivered to info@datawego.nl once, with the visitor as reply-to", async () => {
  const { response, calls } = await send(validPayload());

  assert.equal(response.status, 201);
  assert.deepEqual(await jsonOf(response), { ok: true, accepted: true });
  assert.equal(calls.resend.length, 1);

  const [sent] = calls.resend;
  assert.deepEqual(sent.body.to, ["info@datawego.nl"]);
  assert.equal(sent.body.reply_to, "ana@clinic-example.com");
  assert.equal(sent.body.from, "DataWeGo Website <info@datawego.nl>");
  assert.equal(sent.headers.get("Idempotency-Key"), validPayload().submissionId);
  assert.equal(sent.headers.get("Authorization"), "Bearer re_test_key");

  for (const value of ["Ana Ruiz", "ana@clinic-example.com", "Clinic Nine", "Data platform"]) {
    assert.ok(sent.body.text.includes(value), `body carries ${value}`);
  }
  assert.ok(sent.body.text.includes("unify three EHR extracts"));
});

test("the need is posted as its English value and names the English subject", async () => {
  const { calls } = await send(validPayload({ need: "Healthcare / life sciences" }));

  assert.equal(calls.resend[0].body.subject, "Data enquiry — Healthcare / life sciences");
  assert.ok(calls.resend[0].body.text.includes("Need: Healthcare / life sciences"));
});

test("an origin that is not the page's own is forbidden before anything else", async () => {
  for (const origin of ["https://evil.example", PAGE_ORIGIN.replace("www.", "datawego."), null]) {
    const { response, calls } = await send(validPayload(), { origin });
    assert.equal(response.status, 403, `origin ${String(origin)}`);
    assert.equal(calls.resend.length, 0);
    assert.equal(calls.siteverify.length, 0);
  }
});

test("every response is plain JSON and opts out of caching", async () => {
  for (const options of [{}, { origin: "https://evil.example" }]) {
    const { response } = await send(validPayload(), options);
    assert.equal(response.headers.get("Content-Type"), "application/json");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("a body addressed at another recipient, or carrying an unlisted field, is refused", async () => {
  const addedTo = await send(validPayload({ to: "attacker@example.com" }));
  assert.equal(addedTo.response.status, 400);
  assert.equal(addedTo.calls.resend.length, 0);

  const unknown = await send(validPayload({ surprise: "value" }));
  assert.equal(unknown.response.status, 400);
  assert.equal(unknown.calls.resend.length, 0);
});

test("the website trap refuses a bot with the same generic answer as any bad field", async () => {
  const { response, calls } = await send(validPayload({ website: "http://spam.example" }));

  assert.equal(response.status, 400);
  assert.deepEqual(await jsonOf(response), { ok: false, error: "Invalid request" });
  assert.equal(calls.resend.length, 0);
});

test("no confirmation, a refused confirmation, or a missing secret means no send", async () => {
  const noToken = await send(validPayload({ turnstileToken: undefined }));
  assert.equal(noToken.response.status, 400);
  assert.equal(noToken.calls.resend.length, 0);

  const verifyFailed = await send(validPayload(), { context: { reply: { success: false, "error-codes": ["bad-request"] } } });
  assert.equal(verifyFailed.response.status, 400);
  assert.equal(verifyFailed.calls.resend.length, 0);

  const noSecret = await send(validPayload(), { context: { env: { TURNSTILE_SECRET: undefined } } });
  assert.equal(noSecret.response.status, 400);
  assert.equal(noSecret.calls.resend.length, 0);
  assert.equal(noSecret.calls.siteverify.length, 0, "an unset secret never calls siteverify");
});

test("the confirmation must name the host that served the page", async () => {
  for (const hostname of [
    "edmf.nl",
    "localhost",
    "datawego.nl.attacker.tld",
    "deadbeef.datawego.pages.dev",
    "www.datawego.nl.evil.example",
    undefined,
  ]) {
    const { response, calls } = await send(validPayload(), {
      context: { reply: { success: true, hostname } },
    });
    assert.equal(response.status, 400, `hostname ${String(hostname)}`);
    assert.equal(calls.resend.length, 0);
  }

  for (const [url, origin] of [
    ["https://datawego.nl/api/contact", "https://datawego.nl"],
    ["https://deadbeef.datawego.pages.dev/api/contact", "https://deadbeef.datawego.pages.dev"],
    ["http://localhost:8788/api/contact", "http://localhost:8788"],
  ]) {
    const { response, calls } = await send(validPayload(), {
      url,
      origin,
      context: { reply: async () => ({ success: true, hostname: new URL(url).hostname }) },
    });
    assert.equal(response.status, 201, `${url} is served by its own host`);
    assert.equal(calls.resend.length, 1);
  }
});

/**
 * Both sides of the hostname comparison can come back null: an IP-literal host
 * (which no real deployment serves, but every dev box does) is not a hostname the
 * pattern recognises, and siteverify omits the field for a token minted elsewhere.
 * Two nulls must not read as an agreement, or the gate opens for the whole family.
 */
test("a host that is not a hostname cannot open the gate", async () => {
  for (const hostname of [undefined, "", "[2001:db8::1]", "!!!", "::1"]) {
    const { response, calls } = await send(validPayload(), {
      url: "http://[::1]:8788/api/contact",
      origin: "http://[::1]:8788",
      context: { reply: { success: true, hostname } },
    });
    assert.equal(response.status, 400, `hostname ${String(hostname)}`);
    assert.equal(calls.resend.length, 0, `hostname ${String(hostname)} never reaches the provider`);
  }
});

test("six submissions from one visitor IP inside a minute: five send, the sixth waits", async () => {
  const limiter = kvBinding();
  const statuses = [];
  for (let i = 0; i < 6; i += 1) {
    const { response } = await send(validPayload({ submissionId: `sub-${i}` }), {
      context: { env: { CONTACT_RATE_LIMIT: limiter } },
    });
    statuses.push([response.status, response.headers.get("Retry-After")]);
  }

  assert.deepEqual(
    statuses.map(([status]) => status),
    [201, 201, 201, 201, 201, 429]
  );
  assert.equal(statuses[5][1] !== null, true, "the refusal says when to come back");
});

test("the counter belongs to the address, not to the whole site", async () => {
  for (const ip of ["198.51.100.4", "203.0.113.99"]) {
    const limiter = kvBinding();
    for (let i = 0; i < 5; i += 1) {
      const { response } = await send(validPayload({ submissionId: `${ip}-${i}` }), {
        headers: new Headers({ "CF-Connecting-IP": ip }),
        context: { env: { CONTACT_RATE_LIMIT: limiter } },
      });
      assert.equal(response.status, 201, `${ip} submission ${i}`);
    }
  }

  const limiter = kvBinding();
  const { response } = await send(validPayload(), {
    headers: new Headers({ "CF-Connecting-IP": "198.51.100.4" }),
    context: { env: { CONTACT_RATE_LIMIT: undefined } },
  });
  assert.equal(response.status, 201, "a missing binding skips the counter rather than blocking traffic");
  assert.equal(limiter.store.size, 0);
});

test("field edges are refused without a provider call", async () => {
  const cases = [
    validPayload({ message: "x".repeat(4001) }),
    validPayload({ name: "A" }),
    validPayload({ name: " ".repeat(161) }),
    validPayload({ need: "Free-form wish" }),
    validPayload({ email: "not-an-address" }),
    validPayload({ org: "y".repeat(161) }),
    validPayload({ submissionId: "z".repeat(129) }),
    "this is not json",
  ];

  for (const payload of cases) {
    const { response, calls } = await send(payload);
    assert.equal(response.status, 400, `refuses ${String(payload).slice(0, 24)}`);
    assert.equal(calls.resend.length, 0);
  }

  const wrongType = await send(validPayload(), { headers: new Headers({ "Content-Type": "text/plain" }) });
  assert.equal(wrongType.response.status, 400);
  assert.equal(wrongType.calls.resend.length, 0);
});

test("a provider refusal reaches the visitor as a bare service error", async () => {
  const { response, calls } = await send(validPayload(), { context: { network: { resendStatus: 422 } } });

  assert.equal(response.status, 503);
  assert.deepEqual(await jsonOf(response), { ok: false, error: "Service unavailable" });
  assert.equal(calls.resend.length, 1);
});

test("a missing provider key means no attempt is made at all", async () => {
  const { response, calls } = await send(validPayload(), { context: { env: { RESEND_API_KEY: undefined } } });

  assert.equal(response.status, 503);
  assert.equal(calls.resend.length, 0);
});

test("a retried brief forwards the same idempotency key rather than minting one", async () => {
  const submissionId = "22222222-2222-4222-8222-222222222222";
  const first = await send(validPayload({ submissionId }));
  const second = await send(validPayload({ submissionId }));

  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 201);
  assert.equal(first.calls.resend[0].headers.get("Idempotency-Key"), submissionId);
  assert.equal(second.calls.resend[0].headers.get("Idempotency-Key"), submissionId);
});

/**
 * Each guard has an arm for "I could not find out", and every one of those arms is
 * a refusal — except the throttle, which is the deliberate exception, because a KV
 * outage must not stop a valid enquiry. None of them is reachable from the response
 * an honest visitor gets, so they are reachable here instead.
 */
test("a guard that cannot answer denies, except the throttle, which fails open", async () => {
  const confirmationDown = await send(validPayload(), {
    context: { network: { throwOn: ["siteverify"] } },
  });
  assert.equal(confirmationDown.response.status, 400, "an unreachable confirmation is not a confirmation");
  assert.equal(confirmationDown.calls.siteverify.length, 1, "it tried once");
  assert.equal(confirmationDown.calls.resend.length, 0);
  assert.equal(confirmationDown.logs.length, 1, "and the reason is on the record");

  const confirmationErrored = await send(validPayload(), {
    context: { network: { siteverifyStatus: 503 } },
  });
  assert.equal(confirmationErrored.response.status, 400);
  assert.equal(confirmationErrored.calls.resend.length, 0);
  assert.match(confirmationErrored.logs.join("\n"), /503/, "the status Cloudflare gave is logged");

  const sendDown = await send(validPayload(), {
    context: { network: { throwOn: ["resend"] } },
  });
  assert.equal(sendDown.response.status, 503, "a provider that cannot be reached is not an acceptance");
  assert.equal(sendDown.calls.resend.length, 1);
  assert.equal(sendDown.logs.length, 1);

  const throttleDown = await send(validPayload(), {
    context: { env: { CONTACT_RATE_LIMIT: unavailableKv() } },
  });
  assert.equal(throttleDown.response.status, 201, "a broken counter does not block a valid enquiry");
  assert.equal(throttleDown.calls.resend.length, 1);
});

test("an omitted or blank organisation is a blank in the brief, not a bad request", async () => {
  for (const org of ["", undefined, null]) {
    const { response, calls } = await send(validPayload({ org }));
    assert.equal(response.status, 201, `org ${String(org)} is a valid answer`);
    assert.equal(calls.resend.length, 1);
    assert.ok(
      calls.resend[0].body.text.includes("Organisation: —"),
      `org ${String(org)} renders as an em dash rather than "undefined"`
    );
  }
});

/**
 * "Never fail quietly" is two halves: the visitor sees a sentence, and the mailbox
 * owner sees a line. The second half is what makes an unset secret findable, and it
 * must hold without ever printing the token or the address it is refusing.
 */
test("every refusal leaves a log line that names neither token nor address", async () => {
  const token = validPayload().turnstileToken;
  const cases = [
    await send(validPayload(), { context: { env: { TURNSTILE_SECRET: undefined } } }),
    await send(validPayload(), { context: { network: { throwOn: ["siteverify"] } } }),
    await send(validPayload(), { context: { network: { siteverifyStatus: 500 } } }),
    await send(validPayload(), { context: { env: { RESEND_API_KEY: undefined } } }),
    await send(validPayload(), { context: { network: { resendStatus: 422 } } }),
    await send(validPayload(), { context: { network: { throwOn: ["resend"] } } }),
  ];

  for (const { logs } of cases) {
    const joined = logs.join("\n");
    assert.ok(logs.length >= 1, `one of these is logged: ${JSON.stringify(logs)}`);
    assert.equal(joined.includes(token), false, "the challenge token never reaches a log");
    assert.equal(joined.toLowerCase().includes("ana@"), false, "nor does the visitor's address");
    assert.equal(joined.includes("re_test_key"), false, "nor the provider key");
    assert.equal(joined.includes("1x0000000000000000000000000000000AA"), false, "nor the Turnstile secret");
  }
});

/**
 * The page and the Function hold the same agreement in two copies, because a
 * Function cannot import from an HTML file: the vocabulary of needs, the subject it
 * builds, the one mailbox, and the bounds each field may carry. Nothing but a
 * comment ties them today, so this is the line that stops the pair drifting apart —
 * a seventh <option>, a reworded subject, or a maxlength that outgrows its MAX_*
 * bound makes every honest submit fail, and the suite would stay green without it.
 */
test("the page keeps the send agreement identical to the Function's", () => {
  const page = readFileSync(new URL("../datawego-company-site.html", import.meta.url), "utf8");
  const route = readFileSync(new URL("../functions/api/contact.js", import.meta.url), "utf8");

  const select = page.match(/<select[^>]*id="f-need"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(select, "the page has a #f-need select");
  const optionValues = [...select[1].matchAll(/<option[^>]*\bvalue="([^"]*)"/g)].map(([, raw]) =>
    decodeEntities(raw)
  );
  assert.equal(optionValues.length, NEED_OPTIONS.length, "one option per allowed need");
  assert.deepEqual([...optionValues].sort(), [...NEED_OPTIONS].sort(), "the need vocabulary is the same list");

  const postedNeed = page.match(/need:\s*el\["need"\]\.value/);
  assert.ok(postedNeed, "the page posts the option's value, not its translated label");

  const subject = page.match(/var subject = "([^"]*)"\s*\+\s*v\.need/);
  assert.ok(subject, "the page builds a subject line");
  assert.equal(subject[1], SUBJECT_PREFIX, "the manual subject matches the delivered one word for word");

  const mailto = page.match(/"mailto:([^"?]+)\?/);
  assert.ok(mailto, "the page offers a direct address");
  assert.equal(mailto[1], CONTACT_RECIPIENT, "and it is the same mailbox the Function sends to");

  const maxlengths = {
    "f-name": MAX_NAME_LENGTH,
    "f-email": MAX_EMAIL_LENGTH,
    "f-org": MAX_ORG_LENGTH,
    "f-msg": MAX_MESSAGE_LENGTH,
  };
  for (const [id, bound] of Object.entries(maxlengths)) {
    const field = page.match(new RegExp(`id="${id}"[^>]*maxlength="(\\d+)"`));
    assert.ok(field, `#${id} caps its input`);
    assert.equal(
      Number(field[1]),
      bound,
      `#${id} allows exactly as much as the Function will accept`
    );
  }

  const minimums = new Map(
    [...page.matchAll(/id: "(f-name|f-msg)"[^\n]*?\.length >= (\d+)/g)].map(([, id, n]) => [id, Number(n)])
  );
  assert.equal(minimums.get("f-name"), MIN_NAME_LENGTH, "#f-name asks for as little as the Function does");
  assert.equal(minimums.get("f-msg"), MIN_MESSAGE_LENGTH, "#f-msg asks for as little as the Function does");

  const allowlist = route.match(/const FIELD_ALLOWLIST = Object\.freeze\(\[([\s\S]*?)\]\)/);
  assert.ok(allowlist, "the Function names the fields it accepts");
  const accepted = [...allowlist[1].matchAll(/"([^"]+)"/g)].map(([, key]) => key);
  const body = page.match(/body: JSON\.stringify\(\{([\s\S]*?)\}\)/);
  assert.ok(body, "the page names the body it posts");
  const sent = [...body[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map(([, key]) => key);
  assert.ok(sent.length > 0, "and it is not empty");
  for (const key of sent) {
    assert.ok(accepted.includes(key), `#${key} is posted but not on the allowlist, so every send would 400`);
  }
});

/**
 * The widget's own script refuses the entire render when an option carries a value
 * outside its vocabulary. Only the options api.js actually validates are listed
 * below, read out of its own validator messages at
 * https://challenges.cloudflare.com/turnstile/v0/api.js — a key it does not police
 * cannot break the render, while one of these throws, and the page's catch turns
 * that throw into "the security check failed" for every visitor on every host.
 *
 * Nothing crosses the network and nothing is logged when that happens, and the
 * offline double issues a token for whatever object it is handed, so this suite
 * stayed green while the deployed page refused to send at all. It surfaced only
 * once the live page was driven — which is the reason it is asserted statically now.
 */
const TS_ENUM_OPTIONS = {
  "refresh-expired": ["never", "manual", "auto"],
  "refresh-timeout": ["never", "manual", "auto"],
  execution: ["render", "execute"],
  retry: ["never", "auto"],
  size: ["normal", "compact"],
  theme: ["dark", "light", "auto"],
};

/** The page's turnstile.render() options as one block of source, comments removed. */
function renderOptionBlock(source) {
  const call = source.indexOf("turnstile.render(");
  if (call === -1) return null;
  const open = source.indexOf("{", call);
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}" && (depth -= 1) === 0) { end = i; break; }
  }
  if (end === -1) return null;
  // Comments come out before anything is split on commas. A note written in prose
  // carries commas of its own, and an option annotated that way disappears into the
  // middle of the sentence — the loop below would find nothing to look at and call
  // the page correct. This is how the check itself first went green with "always".
  return source.slice(open + 1, end).replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** That block keyed by option: string values verbatim, anything else as a reference. */
function renderOptions(block) {
  const entries = [];
  let level = 0;
  let piece = "";
  for (const char of block) {
    if (char === "{" || char === "(" || char === "[") level += 1;
    else if (char === "}" || char === ")" || char === "]") level -= 1;
    if (char === "," && level === 0) { entries.push(piece); piece = ""; continue; }
    piece += char;
  }
  entries.push(piece);

  const options = {};
  for (const entry of entries) {
    const pair = entry.match(/^\s*"?([A-Za-z][\w-]*)"?\s*:\s*(.*)$/s);
    if (!pair) continue;
    const literal = pair[2].trim().match(/^"([^"]*)"$/);
    if (literal) options[pair[1]] = literal[1];
    else options[pair[1]] = { reference: pair[2].trim() };
  }
  return options;
}

test("the page hands turnstile.render only values api.js will accept", () => {
  const page = readFileSync(new URL("../datawego-company-site.html", import.meta.url), "utf8");
  const block = renderOptionBlock(page);
  assert.ok(block, "the page renders the widget explicitly");
  const options = renderOptions(block);

  // The read is anchored before any verdict leans on it. These three are the render
  // call's own shape — which key, which success callback, which failure callback — and
  // if the scan stops seeing them an option could sit unchecked while the suite
  // reports green, which is exactly the hole this test was written to close.
  assert.ok(options.sitekey !== undefined, "the site key came off the call");
  assert.ok(options.callback !== undefined, "the success callback came off the call");
  assert.ok(options["error-callback"] !== undefined, "the failure callback came off the call");

  for (const [name, vocabulary] of Object.entries(TS_ENUM_OPTIONS)) {
    const value = options[name];
    if (value === undefined) continue;
    assert.equal(
      typeof value,
      "string",
      `${name} has to be a literal word; api.js reads the value, not a reference`
    );
    assert.ok(
      vocabulary.includes(value),
      `turnstile.render refuses "${name}": "${value}" — it takes ${vocabulary.join("|")}, ` +
        "and a word it refuses throws, failing every send from the page"
    );
  }

  const sitekey = page.match(/var TS_SITEKEY = "([^"]*)"/);
  assert.ok(sitekey, "the site key is named once, in the page");
  assert.match(sitekey[1], /^0x[0-9A-Za-z_]{15,}$/, "and it carries the shape of a Turnstile site key");
  assert.deepEqual(
    options.sitekey,
    { reference: "TS_SITEKEY" },
    "the render call passes that name, so one edit reaches the widget"
  );
});
