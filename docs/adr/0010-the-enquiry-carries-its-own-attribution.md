# The enquiry carries its own attribution; no third-party analytics is added

The site counts nothing today: there is no tag manager, no GA4, no Plausible. The
measure the whole plan is steered by is Organic enquiries (CONTEXT.md), which is
the one number a mailbox can produce without watching anybody, so the recommendation
to install analytics was declined and the alternative is recorded here.

An Enquiry gains an `Attribution:` line built in the page and validated in the
Function: the **origin** of the referrer (`https://www.google.com/` ⇒ organic),
the address the visitor landed on, and the Language variant they read. Origin-only
is not a shortcut — the site is served with `referrer-policy: strict-origin-when-cross-origin`,
so a cross-site referrer cannot arrive with a path or a search query even if we
wanted them, and for the question "did unpaid search bring this?" the origin is
exactly sufficient.

Two constraints come with it, because this is the one place the project touches an
outbound email. The field joins `FIELD_ALLOWLIST` or `allowedKeys` rejects the
request as unknown, and its value is interpolated **only into the message body** —
never into `subject`, `from`, or a header, where a visitor-controlled string is a
mail-header injection. A guard in `tests/contact.test.mjs` asserts the rejection,
so the allowlist cannot be widened by accident.

Cost of the choice, stated as a decision rather than an omission: there is no
funnel. Nobody will ever see "a Dutch visitor read `/dataplatforms/` for four
minutes and left". The two ends are all there is — Google Search Console's queries
and impressions on one side, and the Attribution line on each accepted enquiry on
the other. Reversing this means a consent banner, and a banner is a layer of
layout shift, script and drop-off paid on every page, for data the mailbox already supplies.

## Amendment at U8: what "the landing path" can honestly mean

The field was described above as the address the visitor landed on. A page cannot
know that. There is no session and no storage in this design — that is the cost this
ADR agreed to pay when it declined the funnel — so the only address a browser can
state at the moment of sending is **the address the brief was filled in on**. That is
what `page=` holds, and the distinction is worth writing down because "landing" would
be a claim the deployment cannot support: a visitor who arrived at
`/docs/ehr-platform-architecture-with-prepass.html`, clicked through and wrote from
`/` produces `page=/`, which is the truth available.

Three things were settled while the field was built:

- Each part is validated **alone**, and a part that fails prints as `unknown` rather
  than being dropped. A line that omits a slot cannot be told apart from a page that
  stopped sending it, which is the difference between a gap in the data and a silent
  change in the code.
- Nothing in it may **refuse** an enquiry. Attribution is read after every gate and
  before the send, never among the gates.
- The page reduces `document.referrer` to its origin, and the Function refuses a URL
  that still carries a path rather than trimming it. Trimming would mean deployed code
  guessing at what the field was for.

The two variant names are written again in `functions/api/_contact.js` rather than
imported from the route table — a deployed Worker should not need build input for one
two-value check — so `tests/contact.test.mjs` holds that copy against `LANGS`, which
is what makes it a copy under test instead of a second answer (ADR 0005).
