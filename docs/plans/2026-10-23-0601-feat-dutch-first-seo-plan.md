---
title: "feat: Dutch-first SEO — generated variants, one route table, five surfaces"
type: feat
date: 2026-10-23
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: grilling session 2026-10-23 (ADR 0001–0012)
execution: code
---

# feat: Dutch-first SEO

## Goal Capsule

- **Objective:** Make the site findable by Dutch buyers searching in Dutch, and make the result countable as Organic enquiries (CONTEXT.md) — not as traffic, not as rank.
- **Open blockers:** The 2,000–2,800 words of new Dutch copy (U7–U10) and five Cloudflare/Google dashboard actions (see Dashboard Checklist) that the repository cannot perform.
- **Execution profile:** A build step where the repo advertises none, one generator, ten generated addresses, image re-encoding, and one field added to the contact email.

## Product Contract

### Summary

Everything the SEO work rests on today is broken in a way that no meta tag can fix: Dutch exists only in a browser-side dictionary, the same page answers at three hosts, an unknown URL returns the homepage with status 200, `robots.txt` is a 119KB Cloudflare artifact with no `Sitemap:` line, and there is no structured data, icon, or social card anywhere. The fix is structural and ordered: correctness first (Stage 1, no new copy needed), then the five-surface architecture (Stage 2), then the words (Stage 3).

### Problem Frame

The revenue market is Dutch (owner, 2026-10-22). The site is authored in English and Dutch is applied at runtime (`datawego-company-site.html:1235` dictionary, `:1564` `renderLang`), so a crawler that does not run JavaScript sees an English-only, single-URL site — which also cannot carry `hreflang` at all. Meanwhile the same content is served at `datawego.nl`, `www.datawego.nl`, and `datawego.pages.dev`, all HTTP 200 and byte-identical; `/sitemap.xml` therefore also returns the homepage HTML, and `/robots.txt` returns Cloudflare's managed content-signals block concatenated with that same homepage (119,039 bytes). Five indexable surfaces were chosen because a Page carries one title and one intent, and the Dutch queries with buying intent belong to a kind of work, not to the firm in general.

The mechanism that makes this survivable is generation: a route table is the only list of addresses, and the sitemap, every `rel=canonical`, every `hreflang` pair, the navigation and the breadcrumbs all derive from it. The dictionary keeps its content job and loses its silence — a visible string with no Dutch key fails the build instead of falling back to English (`:1533`).

### Requirements

- **R1:** Each of the ten addresses returns 200 and contains its own language's prose in the served HTML, with no JavaScript executed. Asserted by fetching with `curl` and stripping tags.
- **R2:** `https://www.datawego.nl` is the only host that answers 200; `datawego.nl` 301s to it; `datawego.pages.dev` serves but canonicals elsewhere (ADR 0006).
- **R3:** Canonicals are absolute, trailing-slash directory form, and byte-identical to the corresponding sitemap `loc` and `hreflang` `href` — one route table generates all three (ADR 0005).
- **R4:** `hreflang` is complete or the build fails: every Page has both variants, `x-default` → `/en/` (ADR 0001).
- **R5:** `dist/robots.txt` is authored in this repository: `Allow: /`, a `Sitemap:` line, no `Disallow` for `/docs/`, training crawlers refused, retrieval crawlers welcome, `GoogleOther` unblocked (ADR 0007).
- **R6:** `sitemap.xml` lists exactly the indexable variants (2 after Stage 1, 10 after Stage 2) and nothing else.
- **R7:** An unknown path returns status 404 with the Dutch 404 page; `/robots.txt` and `/sitemap.xml` never return `text/html` (Q9 decision — not an ADR, it is a defect fix).
- **R8:** Each Diagram page carries `noindex, follow` plus a title and description, and stays linked (ADR 0002).
- **R9:** Chrome is external `site.css` / `site.js` with content-hashed names and `immutable` cache headers; HTML stays `must-revalidate` (ADR 0004).
- **R10:** Hero is WebP with `srcset` and explicit dimensions and `fetchpriority="high"`; the footer logo becomes SVG; the site gains favicon (SVG + PNG + `apple-touch-icon`) and a 1200×630 `og:image` with per-variant `og:locale` (Q17).
- **R11:** All JSON-LD derives from one `src/site/company.mjs`: `Organization` (`name` DataWeGo, KvK `identifier`, `email`, `addressLocality` Den Haag, `addressCountry` NL, `sameAs` LinkedIn, `url`), plus `WebSite`/`WebPage`, `Service` on the three Practice-area pages, `BreadcrumbList` on the four sub Pages. No `legalName`, no `Person`, no `LocalBusiness`, no `dateModified`, no `FAQPage`/`HowTo`, no `llms.txt` (ADR 0011).
- **R12:** Every indexable Page carries the sole-practice clause in both variants, from the shared-clause table (ADR 0012).
- **R13:** The runtime language mechanism is retired: boot script (`:22-28`), `localStorage["datawego-lang"]`, and DOM mutation by `renderLang`. The theme toggle and its storage are untouched. EN/NL becomes a link to the other variant.
- **R14:** An Enquiry gains `Attribution:` (referrer **origin**, landing path, variant) — field added to `FIELD_ALLOWLIST`, interpolated into the message body only, with a guard test asserting a crafted value cannot reach `subject`/`from` (ADR 0010).
- **R15:** `deploy.js` runs the generator, and `--check` proves `dist/` matches source; a missing Dutch key fails the build (ADR 0003).
- **R16:** The four new Pages carry 400–700 words of prose each, drafted by the agent from existing site copy + the NL dictionary's settled terminology + the four diagrams' facts, then native-reviewed by the owner before it ships (Q10).
- **R17:** Third-party analytics stays at zero scripts (ADR 0010).
- **R18:** Google Search Console and Bing Webmaster both receive the sitemap, and the ten addresses get an indexing request (Q14).

### Key Decisions

Decided in session, each with its own ADR: Dutch owns the root (0001) · five indexable surfaces, Case studies and Diagram pages out of the index (0002) · variants generated at build time, dictionary parity enforced (0003) · chrome shared by address (0004) · routes declared once in trailing-slash form (0005) · www canonical, no language sniffing (0006) · own robots.txt with a stated AI stance, `/docs/` never disallowed (0007) · the site names nobody (0008) · no Google Business Profile (0009) · attribution inside the enquiry, no analytics (0010) · `Organization`, not `LocalBusiness` (0011) · the sole-practice clause on every Page (0012).

### Scope Boundaries

- **In:** `datawego-company-site.html` becomes the first Page source plus dictionary; new `src/` (route table, facts module, generator); `deploy.js`; `dist/` assets (`robots.txt`, `sitemap.xml`, `404.html`, `_headers`, icons); `functions/api/contact.js` + `_contact.js` + `tests/contact.test.mjs`; `resources/` image re-encode; `README.md` and `docs/DESIGN-HANDOFF.md` wording about the single file and the build step.
- **Out:** the four Diagram pages' drawings (only their `<head>` gains meta); blog/content marketing; backlink outreach; multi-language beyond nl/en; renaming any slug after Stage 2 ships.

## Planning Contract

### Key Technical Decisions

- Generation is a Node script in the repo (no framework, no bundler), consistent with a site that has always been one file. It parses the Page source, applies the dictionary at build time, and emits HTML.
- The dictionary format survives as build input. Its exact-string keys are a liability at ten addresses, which is what R15's hard failure is for.
- `hreflang` is emitted as `<link rel="alternate">`, absolute, from the route table. No server-side redirects based on `Accept-Language`.
- Images are re-encoded with Pillow 10.2.0 / ffmpeg (both present; `cwebp`, ImageMagick, `avifenc` are not), so the encoder step is local and needs no new dependency.

### Assumptions

- Cloudflare Pages serves `404.html` with a 404 status when the file exists (verify in Stage 1, R7).
- The Pages custom-domain settings expose the apex→www redirect (R2). Supported, not yet verified: the zone export (kept local, `docs/datawego.nl.txt`, because it also lists tunnel hosts that are not this site's) shows `datawego.nl` and `www.datawego.nl` both CNAME-proxied to `datawego.pages.dev`, which is why the fix is a Pages/zone redirect rather than a DNS edit — and why the apex currently answers 200 with the homepage instead of redirecting.
- The zone's Content-Signals managed robots can be disabled; otherwise R5 and R7 conflict with the injected preamble.
- KvK 42077839 is an eenmanszaak registration — owner's statement, not independently verified here.
- **Closed 2026-10-23, owner's decision A:** the live footer (`datawego-company-site.html`) published a full street address (`Spieringdam 1 / 2492 ND Den Haag`; the Kadaster's BAG lists the parcel with a `woonfunctie`, so it is probably a home address) while `src/site/company.mjs` states the firm at city level. The city wins. **U3 deletes the footer's three address lines, the two `not copy` ledger entries naming the first two, and the `"The Netherlands": "Nederland"` dictionary key that translates the third — one change.** Each half is an assertion elsewhere: a ledger entry for a line no longer shown fails `sourceProblems`, an unledgered English survivor fails the Dutch variant, and a dictionary key nobody says fails the build. The register stays at `streetAddress: null`, so nothing scrapable ever carried a home address. Recorded in ADR 0011's second amendment.
- Pages' "Not found behavior" is not pinned to `index.html`; if it is, 404.html never runs.

### Sources and Research

Verified on 2026-10-22/23 against the live site and the repository: three hosts answering 200 identically; `robots.txt` 119,039 B = 2.7KB Cloudflare preamble + full homepage; `/this-page-does-not-exist-xyz` → 200 `text/html`; 33 `Disallow` blocks, no `Sitemap:` line, `GoogleOther` blocked, `Content-Signal: search=yes,ai-train=no,use=reference`; page 113,253 B = CSS 30,671 + JS 45,218 (dictionary 23,261) + nav 2,267 + footer 2,467 + prose 32,630; 1,462 words of visible copy; dictionary 206 keys over 222 strings with 3 prose gaps, all proper names; `og:`/`twitter:`/`canonical`/`<link>`/JSON-LD all 0 occurrences; analytics 0; hero PNG 1,461,198 B at 2056×491; footer logo PNG 1,337,366 B shown at 105×70; `srcset`/`<picture>`/webp 0; 1 of 2 `<img>` sized. Reference implementation read in `~/projects/edm_home`: `scripts/generate-static-pages.mjs` (`shell()` — one declaration feeding canonical + sitemap), `vite.config.ts` JSON-LD hook, `public/_headers`, `public/robots.txt`, `CONTEXT.md`, `docs/adr/0001–0006`; and its defect, copied deliberately not at all: canonical/sitemap in bare form while Pages 308s `/organization` → `/organization/`.

## Implementation Units

### Stage 1 — correctness, no new copy

- **U1. Route table + facts module.** `src/site/routes.mjs` (nine routes: five Pages in two variants, four single-address Diagram pages; both display names per route) and `src/site/company.mjs` (KvK, email, Den Haag, LinkedIn, origin, the sole-practice clause). Nothing else may state an address or a company fact. `.mjs` rather than `.ts`: the repo has no `package.json` and no TypeScript toolchain, and a root `.js` file is CommonJS, which the generator and the tests both need to avoid. Guarded by `tests/seo-routes.test.mjs`.
- **U2. Generator.** Applies the dictionary at build time to produce `dist/index.html` (Dutch) and `dist/en/index.html`; emits `head` per route: title, description, canonical, hreflang, robots, OG, `jsonld`. Enforces R4 and R15.
- **U3. Shared chrome.** Extract `site.css` / `site.js` (behaviour only) with content-hashed names; strip the boot/`renderLang`/`localStorage` language path (R13); EN/NL becomes two links; delete the footer's street address, its two ledger entries and the dictionary key for its third line with it (ADR 0011 amendment).
  **Made 2026-10-23, owner's reading of "strip":** R13 is measured on shipped bytes. The authored file keeps `renderLang`, the language boot and `localStorage["datawego-lang"]`, because it is the one artifact that opens from disk as a bilingual preview; the generator removes that span while emitting each variant. What makes this safe rather than a lie is that the guard reads the emitted page *and* its chrome together — a runtime that moved into `site.js` instead of being deleted fails the build (ADR 0003 keeps the dictionary as build input either way, so nothing is served that is not also authored).
- **U4. Static SEO assets.** `dist/robots.txt` (R5), `dist/sitemap.xml` (R6, 2 rows), `dist/404.html` (R7), `dist/_headers` (R9 + HSTS; no `X-Robots-Tag`, ADR 0006).
- **U5. Images and icons.** WebP srcset hero with dimensions and `fetchpriority`; logo → SVG; favicon set; `og:image` 1200×630 (R10).
- **U6. Diagram pages.** `noindex, follow` + title/description, drawings untouched (R8).
  **Made 2026-10-23:** the four heads are in `src/site/diagrams.mjs`, not in
  `docs/*.html`, because archify rewrites the whole document on the next export
  and two of the four shipped titles are its guesses (one is still a Python
  module name). R8's "drawings untouched" is asserted as everything from
  `</head>` onward being byte-identical to the committed file. English copy, one
  entry per route, no canonical — see the amendment to ADR 0002.
- **U7. Structured data.** `Organization` + `WebSite` + `WebPage` generated from `company.mjs` (R11).
- **U8. Enquiry attribution.** Allowlisted field, body-only, guard test (R14).
- **Ship:** deploy, then run every assertion under Verification Contract. Then dashboard items ①②③.

### Stage 2 — structure

- **U9. Four new Page sources** (`/dataplatforms/`, `/ai-oplossingen/`, `/cloud-en-enterprise-software/`, `/zorg-en-life-sciences/`) + `Service`/`BreadcrumbList` + route-table-driven navigation on all ten addresses (R3, R11, R12). No prose invented yet: placeholders are forbidden — a page ships with its copy or does not ship.

### Stage 3 — words

- **U10.** Draft 400–700 words × 4 Pages (English + Dutch from the same facts), owner's native review, then deploy the sitemap at 10 rows and request indexing (R16, R18).

## Verification Contract

```sh
# R1/R2  one host, two languages, no JavaScript in the evidence
curl -sI https://datawego.nl/            | grep -qi '^HTTP/2 301'
curl -s  https://www.datawego.nl/en/     | grep -o '<html lang="[a-z]*"'   # en
curl -s  https://www.datawego.nl/        | grep -c 'dataplatform'          # >0, Dutch in served HTML
curl -sI https://datawego.pages.dev/     | grep -vi 'x-robots'            # no header; canonical does the work
# R7  the defect, gone
curl -s  -o /dev/null -w '%{http_code} %{content_type}\n' https://www.datawego.nl/nope-xyz   # 404 text/html
curl -s  https://www.datawego.nl/robots.txt | wc -c                                          # 611 B (565 authored + the build's Sitemap: line), not 119039
curl -sS https://www.datawego.nl/robots.txt | grep -i sitemap
curl -s  https://www.datawego.nl/sitemap.xml | head -1                                      # <?xml …
# R3/R4  agreement between the three places that name an address
comm -3 <(curl -s …/sitemap.xml | grep -o '<loc>[^<]*' | cut -c6- | sort) \
        <(curl -s …/ | grep -o 'rel="canonical" href="[^"]*' | cut -d'"' -f3 | sort)        # empty
# R15  the build refuses a half-translated page
node build.mjs --check && echo "dist current"
printf 'x' | node --test tests/contact.test.mjs   # plus the new injection guard
```

## Dashboard Checklist (owner — the agent can only verify the effect)

| # | Where | Do | Verified by |
|---|---|---|---|
| ① | Cloudflare Pages → datawego → Settings → Domains, on the `datawego.nl` row | apex→www redirect ON. `docs/datawego.nl.txt` shows both `datawego.nl` and `www.datawego.nl` already CNAME to `datawego.pages.dev`, so **no DNS record changes**: this is the Pages toggle, and if it is absent on this plan a zone Redirect Rule does the same job | `curl -sI https://datawego.nl/ \| grep -i '^location'` → `https://www.datawego.nl/` |
| ② | Cloudflare zone → bot/Content-Signals managed robots | **disable** the managed robots.txt injection | `robots.txt` size 611 B, `Content-Signal` gone |
| ③ | Cloudflare Pages → Settings → Build & functions / not-found behaviour | must **not** force `index.html`; `404.html` answers | unknown path → 404 |
| ④ | Google Search Console | verify `datawego.nl` as a **domain** property — one TXT at `_googlehosted.datawego.nl` in this Cloudflare zone covers every subdomain, and the zone already carries TXT records so the record type is not a problem | it prefers the domain property over the URL-prefix one because R2 makes www the only host that answers, and a URL-prefix property would have to be claimed twice; then submit the sitemap and request indexing for the live addresses | GSC sitemap status + coverage |
| ⑤ | Bing Webmaster Tools | import from GSC, confirm sitemap (ChatGPT retrieval leans on the Bing index — ADR 0007 welcomes those crawlers) | Bing sitemap accepted |

## Definition of Done

Dutch prose is in the served HTML of `/` and counts as a real page to Google, Bing and a retrieval crawler; one address per variant answers at www with a matching canonical, sitemap and hreflang set; an unknown URL says 404 in Dutch; `robots.txt` is 611 bytes and names the sitemap; `dist/` cannot be stale and a page cannot be half-Dutch without failing the build; the hero and logo cost under a tenth of what they cost today; and an Organic enquiry is identifiable in the mailbox by its `Attribution:` line.

## System-Wide Impact

`README.md:10` ("No build step") becomes wrong and is rewritten; `docs/DESIGN-HANDOFF.md:46`'s self-containment clause is now conditional on a single screen and the site has five; `deploy.js` grows a build phase and starts copying `dist/assets`; `functions/api/_contact.js` gains one allowlisted field; the runtime dictionary moves from shipped bytes to build input, which is why the per-page JS roughly halves; and the site's language of record for external claims is Dutch, so `CONTEXT.md` is where a future reader learns that "Werkvelden", `Dataplatforms` and `zorgteams` are load-bearing words, not translations.
