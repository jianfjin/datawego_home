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
