/**
 * Shared pieces for POST /api/contact.
 *
 * Ported in behaviour from ~/projects/edm_home/functions/api/_publicForms.ts, with
 * two deliberate differences: the confirmation check insists on the host that
 * served the page, and the throttle is a KV counter because Pages Functions have
 * no rate-limit binding.
 *
 * Files in functions/ whose name starts with an underscore are not routes, so this
 * module is reachable only to the Function that imports it.
 */

export const CONTACT_RECIPIENT = "info@datawego.nl";
export const SUBJECT_PREFIX = "Data enquiry — ";

export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 160;
export const MAX_EMAIL_LENGTH = 320;
export const MAX_ORG_LENGTH = 160;
export const MIN_MESSAGE_LENGTH = 12;
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_SUBMISSION_ID_LENGTH = 128;
export const MAX_REFERRER_LENGTH = 160;
export const MAX_PAGE_PATH_LENGTH = 200;

/**
 * The two Language variants, as the send path knows them.
 *
 * `src/site/routes.mjs` holds the site's list, and the Worker that answers
 * POST /api/contact does not read it: the route table is build input, and the
 * table also names planned addresses and Diagram pages, which the send path has
 * no business knowing. So the two words are named again here, and
 * `tests/contact.test.mjs` holds this list against `LANGS` on every run, which is
 * what makes it a copy under test rather than a second answer (ADR 0005).
 */
export const VARIANTS = Object.freeze(["nl", "en"]);

/**
 * The English `value` attributes of #f-need. Labels translate, values do not, so one
 * mailbox search finds every enquiry about a need whichever language it arrived in.
 */
export const NEED_OPTIONS = Object.freeze([
  "Data platform",
  "AI-powered solution",
  "Cloud & architecture",
  "Data governance",
  "Healthcare / life sciences",
  "Something else",
]);

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_PER_WINDOW = 5;

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_URL = "https://api.resend.com/emails";

export function jsonNoStore(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: { ...init.headers, "Cache-Control": "no-store" },
  });
}

/** A hostname as Cloudflare compares it: lowercase, no port, no trailing dot. */
function normalizeHostname(value) {
  if (typeof value !== "string") return null;
  const host = value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.+$/, "");
  return /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(host) ? host : null;
}

/** The host that served this request, which is the only host a token may name. */
function servingHost(request) {
  return normalizeHostname(new URL(request.url).hostname);
}

export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin !== null && origin === new URL(request.url).origin;
}

function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= MAX_EMAIL_LENGTH ? email : null;
}

export function bounded(value, min, max) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length >= min && result.length <= max ? result : null;
}

/**
 * Where an enquiry came from, in the only form the page is allowed to claim.
 *
 * An empty referrer is not missing information, it is a fact: nobody referred
 * them, so `direct`. Anything else has to be an origin — a scheme and a host, no
 * path, no query, no credentials — because `document.referrer` is a full URL and
 * the browser only ever tells us which site it came from anyway. A crafted
 * string that is not an origin becomes null, and null is printed as `unknown`.
 */
export function attributionReferrer(value) {
  if (typeof value !== "string") return null;
  if (value === "") return "direct";
  if (value.length > MAX_REFERRER_LENGTH) return null;
  return /^https?:\/\/[a-z0-9]([a-z0-9._-]*[a-z0-9])?(:\d+)?$/.test(value) ? value : null;
}

/**
 * The address the brief was filled in on: a path on this host, never a URL.
 *
 * The character set is the guard. It excludes CR, LF, space, `=`, `?`, `#` and
 * `\\`, so a value can neither end the Attribution line early nor begin a line
 * that looks like one of the fields above it. `https://…` is refused here rather
 * than trimmed, because a page that sends a URL for its own address has changed
 * what the field means.
 */
export function attributionPage(value) {
  if (typeof value !== "string" || value.length > MAX_PAGE_PATH_LENGTH) return null;
  if (!/^\/[a-z0-9._-]*(\/[a-z0-9._-]*)*$/.test(value)) return null;
  // The charset already keeps out everything a mail transport reads as syntax, so
  // the lie left to tell is a path that is not this site's: a dot segment resolves
  // somewhere else, and no address the generator writes contains one (ADR 0005).
  if (value.split("/").some((segment) => segment === ".." || segment === ".")) return null;
  return value;
}

/** Which variant the visitor read, or null. Stated by the document's own `lang`. */
export function attributionVariant(value) {
  return typeof value === "string" && VARIANTS.includes(value) ? value : null;
}

/**
 * The mailbox's one sentence about how an enquiry arrived (ADR 0010).
 *
 * `unknown` is a value in it, never an omission: an enquiry that loses all three
 * parts still says that nothing could be read, which is different from a line
 * that is not there and leaves the reader guessing about the send path.
 */
export function attributionLine({ referrer, page, variant }) {
  return `Attribution: referrer=${referrer ?? "unknown"} page=${page ?? "unknown"} variant=${variant ?? "unknown"}`;
}

export function allowedKeys(value, keys) {
  return Object.keys(value).every((key) => keys.includes(key));
}

export async function parsePublicJson(request) {
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") return null;
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Did Turnstile confirm this visitor, on the host that served the page?
 *
 * An unset secret, a short token, a `success: false`, or a hostname that is not
 * exactly this host all answer no. The hostname test is not optional: the same
 * sitekey also guards edmf.nl, and a contains- or suffix-style comparison would
 * let datawego.nl.attacker.tld through.
 */
export async function verifyTurnstile(request, env, token) {
  if (!env.TURNSTILE_SECRET) {
    console.error("contact: TURNSTILE_SECRET is unset, so every enquiry is refused");
    return false;
  }
  if (typeof token !== "string" || token.length < 10) return false;

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET,
    response: token,
    remoteip: clientIp(request),
  });

  try {
    const response = await fetch(SITEVERIFY_URL, { method: "POST", body });
    if (!response.ok) {
      console.error(`contact: siteverify answered ${response.status}`);
      return false;
    }
    const result = await response.json();
    if (result?.success !== true) return false;
    // Two nulls are not an agreement: an IP-literal host normalises to null, and
    // siteverify omits the field for a token minted on another host.
    const confirmed = normalizeHostname(result.hostname);
    return confirmed !== null && confirmed === servingHost(request);
  } catch (error) {
    console.error(`contact: siteverify could not be reached (${error?.message ?? "unknown error"})`);
    return false;
  }
}

/**
 * Five accepted submissions per visitor IP address per minute.
 *
 * The window is anchored at the first request it counts. A KV read-then-write is
 * only eventually consistent, so this is a backstop against a retrying visitor and
 * against one office's shared address — Turnstile is the gate. A missing binding or
 * a failing read skips the counter rather than blocking traffic, which is the one
 * deliberate exception to "every uncertain gate denies".
 */
export async function limitByIp(request, env) {
  const kv = env.CONTACT_RATE_LIMIT;
  if (!kv) return { allowed: true, retryAfter: null };

  const key = `contact:${clientIp(request)}`;
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;

  try {
    const now = Date.now();
    const stored = JSON.parse((await kv.get(key)) ?? "null");
    const fresh =
      stored &&
      typeof stored.startedAt === "number" &&
      typeof stored.count === "number" &&
      now - stored.startedAt < windowMs;
    const windowStartedAt = fresh ? stored.startedAt : now;
    const count = fresh ? stored.count : 0;

    if (count >= RATE_LIMIT_MAX_PER_WINDOW) {
      return {
        allowed: false,
        retryAfter: String(Math.max(1, Math.ceil((windowStartedAt + windowMs - now) / 1000))),
      };
    }

    await kv.put(
      key,
      JSON.stringify({ startedAt: windowStartedAt, count: count + 1 }),
      { expirationTtl: RATE_LIMIT_WINDOW_SECONDS * 2 }
    );
    return { allowed: true, retryAfter: null };
  } catch {
    return { allowed: true, retryAfter: null };
  }
}

/**
 * Hand one enquiry to Resend. The key is forwarded, never regenerated, so a retry
 * of the same brief is the same send.
 *
 * A refusal logs the provider's status and error name — enough to trace a visitor's
 * "it wouldn't send" — and deliberately not the whole response body, which can carry
 * the visitor's address.
 */
export async function sendResend(env, { to, from, replyTo, subject, text, idempotencyKey }) {
  if (!env.RESEND_API_KEY) {
    console.error("contact: RESEND_API_KEY is unset, so every enquiry is refused");
    return false;
  }
  if (!from) return false;

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, text }),
    });
    if (response.ok) return true;

    const detail = await response.json().catch(() => null);
    console.error(
      `contact: Resend refused the send (status ${response.status}${detail?.name ? `, ${detail.name}` : ""})`
    );
    return false;
  } catch (error) {
    console.error(`contact: Resend could not be reached (${error?.message ?? "unknown error"})`);
    return false;
  }
}
