/**
 * POST /api/contact — deliver one composed enquiry to info@datawego.nl.
 *
 * The gates run in this order and each family answers with its own status, so the
 * page can say the right thing about a refusal:
 *
 *   same origin?        no -> 403
 *   fields, trap, list? no -> 400
 *   Turnstile confirms
 *   this exact host?    no -> 400
 *   IP under the cap?   no -> 429 + Retry-After
 *   Resend accepted?    no -> 503
 *                        ok -> 201
 *
 * Nothing is echoed back to the visitor beyond those labels, and no request can aim
 * the send anywhere but the recipient below.
 */

import {
  allowedKeys,
  attributionLine,
  attributionPage,
  attributionReferrer,
  attributionVariant,
  bounded,
  CONTACT_RECIPIENT,
  jsonNoStore,
  limitByIp,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_ORG_LENGTH,
  MAX_SUBMISSION_ID_LENGTH,
  MIN_MESSAGE_LENGTH,
  MIN_NAME_LENGTH,
  NEED_OPTIONS,
  normalizeEmail,
  parsePublicJson,
  sameOrigin,
  sendResend,
  SUBJECT_PREFIX,
  verifyTurnstile,
} from "./_contact.js";

const FIELD_ALLOWLIST = Object.freeze([
  "name",
  "email",
  "org",
  "need",
  "message",
  "turnstileToken",
  "submissionId",
  "website",
  // The three attribution fields (ADR 0010). A page that predates them still
  // sends: an absent part reads `unknown`, and losing the sentence is a smaller
  // loss than refusing an enquiry somebody wrote.
  "referrer",
  "page",
  "variant",
]);

// Built inside the handler: workerd forbids constructing a Response in global scope,
// so a module-level constant here would stop the Worker from starting at all.
const invalidRequest = () => jsonNoStore({ ok: false, error: "Invalid request" }, { status: 400 });

export const onRequestPost = async ({ request, env }) => {
  if (!sameOrigin(request)) {
    return jsonNoStore({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await parsePublicJson(request);
  if (!data || !allowedKeys(data, FIELD_ALLOWLIST) || data.website) return invalidRequest();

  const name = bounded(data.name, MIN_NAME_LENGTH, MAX_NAME_LENGTH);
  const email = normalizeEmail(data.email);
  const orgOmitted = data.org === undefined || data.org === null || data.org === "";
  const org = orgOmitted ? null : bounded(data.org, 1, MAX_ORG_LENGTH);
  const need = typeof data.need === "string" && NEED_OPTIONS.includes(data.need) ? data.need : null;
  const message = bounded(data.message, MIN_MESSAGE_LENGTH, MAX_MESSAGE_LENGTH);
  const submissionId = bounded(data.submissionId, 1, MAX_SUBMISSION_ID_LENGTH);

  if (!name || !email || !need || !message || !submissionId) return invalidRequest();
  if (org === null && !orgOmitted) return invalidRequest();

  if (!(await verifyTurnstile(request, env, data.turnstileToken))) return invalidRequest();

  const limit = await limitByIp(request, env);
  if (!limit.allowed) {
    return jsonNoStore({ ok: false, error: "Try again later" }, {
      status: 429,
      headers: { "Retry-After": limit.retryAfter ?? "60" },
    });
  }

  /* Read after the gates, never before one: attribution describes the enquiry, and
     nothing in it may decide whether the enquiry is delivered. Its values are
     visitor-controlled, which is why they land in `text` and nowhere in `subject`,
     `from`, `to` or `reply_to`. */
  const attribution = attributionLine({
    referrer: attributionReferrer(data.referrer),
    page: attributionPage(data.page),
    variant: attributionVariant(data.variant),
  });

  const accepted = await sendResend(env, {
    to: CONTACT_RECIPIENT,
    from: env.CONTACT_FROM ?? `DataWeGo Website <${CONTACT_RECIPIENT}>`,
    replyTo: email,
    subject: `${SUBJECT_PREFIX}${need}`,
    text: `Name: ${name}\nEmail: ${email}\nOrganisation: ${org ?? "—"}\nNeed: ${need}\n${attribution}\n\n${message}`,
    idempotencyKey: submissionId,
  });

  if (!accepted) return jsonNoStore({ ok: false, error: "Service unavailable" }, { status: 503 });
  return jsonNoStore({ ok: true, accepted: true }, { status: 201 });
};
