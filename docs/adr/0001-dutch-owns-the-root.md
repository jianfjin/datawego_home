# The Dutch variant owns the root URL; English moves under /en/

The site is one URL whose markup is English and whose Dutch is applied in the
browser from an in-page dictionary (`datawego-company-site.html:1235`, rendered
by `renderLang` at `:1564`). That is invisible to a crawler that does not run
JavaScript, and it cannot carry `hreflang`, so a Dutch-first market can never be
reached through it. The revenue market is Dutch, and the surfaces Dutch buyers
search for are five Pages (ADR 0002).

We decided the **Dutch variant is what `/` serves**, and English lives at
`/en/…`. Each of the five Pages exists in two variants with two addresses, and
every variant names the other in `hreflang`; `x-default` points at `/en/`, so a
visitor whose language the site has no basis to predict lands on the variant
almost everyone can read.

Rejected:

- **`/` stays English, Dutch goes to `/nl/`** — keeps the address printed on the
  business card and the LinkedIn link pointing at the wrong language for the
  market that pays, and makes the Dutch set a "translation folder", which is the
  kind of surface that quietly decays.
- **`nl.datawego.nl`** — splits the domain's authority across two hosts for a
  five-page site, and costs DNS, a certificate, and a redirect to buy nothing.
- **Keep the runtime toggle and rely on Google's rendering** — Googlebot does run
  JavaScript; Bing, DuckDuckGo, Apple's indexers and every retrieval crawler that
  matters for AI answers do not treat a dictionary swap as content. This is also
  the status quo, which is why the Dutch market currently sees nothing.

Consequences we accept:

- The two variants of one Page are one object: half a mirror is not a smaller
  site, it is an invalid `hreflang` set, and Google drops the annotations rather
  than guess. Completeness has to be checked, not remembered.
- The English markup stops being "the site" and becomes the source of `/en/`.
- Existing links to `/` now render Dutch. `x-default → /en/` and the language
  control are the way out for those visitors.
