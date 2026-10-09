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
const MAX_EMAIL_LENGTH = 320;
export const MAX_ORG_LENGTH = 160;
export const MIN_MESSAGE_LENGTH = 12;
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_SUBMISSION_ID_LENGTH = 128;

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
  if (!env.TURNSTILE_SECRET || typeof token !== "string" || token.length < 10) return false;

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET,
    response: token,
    remoteip: clientIp(request),
  });

  try {
    const response = await fetch(SITEVERIFY_URL, { method: "POST", body });
    if (!response.ok) return false;
    const result = await response.json();
    if (result?.success !== true) return false;
    return normalizeHostname(result.hostname) === servingHost(request);
  } catch {
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
  if (!env.RESEND_API_KEY || !from) return false;

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
