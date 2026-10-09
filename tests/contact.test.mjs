/**
 * Guard tests for POST /api/contact (functions/api/contact.js).
 *
 * Dependency-free on purpose: plain node --test, a stubbed global fetch, and a
 * fake KV binding. Run with `node --test` from the repository root.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { onRequestPost } from "../functions/api/contact.js";

const PAGE_ORIGIN = "https://www.datawego.nl";
const ENDPOINT = `${PAGE_ORIGIN}/api/contact`;
const RESEND = "https://api.resend.com/emails";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function bodyField(field, value) {
  const payload = { ...validPayload(), [field]: value };
  return { payload };
}

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
 * `reply` steers the siteverify answer; `resendStatus` steers the provider.
 */
function stubNetwork({ reply, resendStatus = 200 } = {}) {
  const calls = { siteverify: [], resend: [] };
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === SITEVERIFY) {
      calls.siteverify.push({ form: new URLSearchParams(init.body ?? ""), headers: init.headers });
      const result = await (typeof reply === "function" ? reply() : reply ?? { success: true, hostname: "www.datawego.nl" });
      return jsonResponse(200, result);
    }
    if (url === RESEND) {
      calls.resend.push({ body: JSON.parse(init.body), headers: new Headers(init.headers ?? {}) });
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
  try {
    const response = await onRequestPost({
      request: request(payload, requestOptions),
      env: env(context.env),
      waitUntil() {},
      next: async () => Response.error(),
    });
    return { response, calls: network.calls };
  } finally {
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

test("every response opts out of caching", async () => {
  const ok = await send(validPayload());
  assert.equal(ok.response.headers.get("Cache-Control"), "no-store");

  const refused = await send(validPayload(), { origin: "https://evil.example" });
  assert.equal(refused.response.headers.get("Cache-Control"), "no-store");
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

test("six submissions from one visitor IP inside a minute: five send, the sixth waits", async () => {
  const limiter = kvBinding();
  const statuses = [];
  for (let i = 0; i < 6; i += 1) {
    const network = stubNetwork();
    try {
      const response = await onRequestPost({
        request: request(validPayload({ submissionId: `sub-${i}` })),
        env: env({ CONTACT_RATE_LIMIT: limiter }),
      });
      statuses.push([response.status, response.headers.get("Retry-After")]);
    } finally {
      network.restore();
    }
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
      const network = stubNetwork();
      try {
        const response = await onRequestPost({
          request: request(validPayload({ submissionId: `${ip}-${i}` }), {
            headers: new Headers({ "CF-Connecting-IP": ip }),
          }),
          env: env({ CONTACT_RATE_LIMIT: limiter }),
        });
        assert.equal(response.status, 201, `${ip} submission ${i}`);
      } finally {
        network.restore();
      }
    }
  }

  const limiter = kvBinding();
  const network = stubNetwork();
  try {
    const response = await onRequestPost({
      request: request(validPayload(), { headers: new Headers({ "CF-Connecting-IP": "198.51.100.4" }) }),
      env: env({ CONTACT_RATE_LIMIT: undefined }),
    });
    assert.equal(response.status, 201, "a missing binding skips the counter rather than blocking traffic");
    assert.equal(limiter.store.size, 0);
  } finally {
    network.restore();
  }
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
