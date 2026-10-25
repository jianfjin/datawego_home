---
title: "feat: Dutch-first SEO — generated variants, one route table, five surfaces"
type: feat
date: 2026-10-23
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: grilling session 2026-10-23 (ADR 0001–0013)
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
- **R19:** Nothing a page asks for resolves outside what this build wrote. Every `src`, `srcset` entry, `poster` and internal `href` is rooted or absolute, so one request means one file from `/` and from `/en/` alike, and a Diagram link names the address Pages answers rather than the file holding the drawing (ADR 0005's second amendment).

### Key Decisions

Decided in session, each with its own ADR: Dutch owns the root (0001) · five indexable surfaces, Case studies and Diagram pages out of the index (0002) · variants generated at build time, dictionary parity enforced (0003) · chrome shared by address (0004) · routes declared once in trailing-slash form (0005) · www canonical, no language sniffing (0006) · own robots.txt with a stated AI stance, `/docs/` never disallowed (0007) · the site names nobody (0008) · no Google Business Profile (0009) · attribution inside the enquiry, no analytics (0010) · `Organization`, not `LocalBusiness` (0011) · the sole-practice clause on every Page (0012) ·
the page HTML shared by composition from the home document (0013).

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
  **Made 2026-10-23, at the stage-1 deploy:** every reference this step names is emitted
  rooted (`/assets/<name>`), not relative. The nine artwork files and the two chrome files
  were given as bare paths, which resolve against the *directory of the page*, so the whole
  set was correct at `/` and 404 at `/en/` — the logo, the four hero widths, three icons and
  the 404 page's own sheet. `og:image` keeps its absolute URL, because there the origin is
  already the root. R19 asserts a page's requests against the build's file list, from each
  page's own address, in both variants; the not-found page is asserted to ask for nothing
  relative at all, since it answers at an address it cannot know.
- **U6. Diagram pages.** `noindex, follow` + title/description, drawings untouched (R8).
  **Made 2026-10-23:** the four heads are in `src/site/diagrams.mjs`, not in
  `docs/*.html`, because archify rewrites the whole document on the next export
  and two of the four shipped titles are its guesses (one is still a Python
  module name). R8's "drawings untouched" is asserted as everything from
  `</head>` onward being byte-identical to the committed file. English copy, one
  entry per route, no canonical — see the amendment to ADR 0002.
  **Made 2026-10-23, at the stage-1 deploy:** the four addresses are declared bare
  (`/docs/<name>`), because that is the only form Pages answers with 200 — it 308s both
  `.html` and the trailing-slash spelling to it — and because a `.html` in a company URL is
  the noise ADR 0005 rejected the first time. The drawing keeps its file name; one mapping in
  `build.mjs` says which file an address is served from. The four links now come from that
  same table as `{{LINK:<key>}}` rather than from `href="docs/<name>.html"` typed by hand,
  which is what makes them right in the English variant, where the hand-written form
  resolved to `/en/docs/<name>.html` and answered 404. Older links, bookmarks and any
  citation of the `.html` spelling keep working on the platform's 308 alone.
- **U7. Structured data.** `Organization` + `WebSite` + `WebPage` generated from `company.mjs` (R11).
  **Made 2026-10-23:** one `<script type="application/ld+json">` per Page variant,
  last in the head, about 1.6KB. `WebSite` on the home Pages only, per ADR 0011's
  per-page list; `Service` and `BreadcrumbList` arrive with U9 and point at the same
  `@id`s rather than describing the firm twice. The Diagram pages carry no graph —
  ADR 0011's U7 amendment says why. One prose/graph pair was closed on the way: the
  footer's registry line spelled `KVK-nummer` while the graph's `propertyID` says
  `KvK-nummer`, and two spellings of one registry is how a pair stops being
  checkable, so `tests/seo-graph.test.mjs` now compares the number in both.
- **U8. Enquiry attribution.** Allowlisted field, body-only, guard test (R14).
  **Made 2026-10-23:** three fields, not one — `referrer`, `page`, `variant` — each
  validated on its own and joined into a single `Attribution:` line, because a slot
  that silently disappears is indistinguishable from a page that stopped sending it.
  `page` is the address the brief was filled in on rather than the address the visitor
  landed on; the site keeps no session, so "landing" is not knowable (ADR 0010's
  amendment). Attribution is read after the gates and never among them, so no odd
  referrer ever refuses an enquiry. The two variant names are copied into
  `functions/api/_contact.js` and held against `LANGS` by a test, and the page sends
  `document.documentElement.lang` rather than a literal, so the line is identical in
  both variants and nothing in it is a sentence.
- **Ship:** deploy, then run every assertion under Verification Contract. Then dashboard items ①②③.

### Stage 2 — structure

- **U9. Four new Page sources** (`/dataplatforms/`, `/ai-oplossingen/`, `/cloud-en-enterprise-software/`, `/zorg-en-life-sciences/`) + `Service`/`BreadcrumbList` + route-table-driven navigation on all ten addresses (R3, R11, R12). No prose invented yet: placeholders are forbidden — a page ships with its copy or does not ship.
  **Made 2026-10-23:** the four sources are Bodies, not documents (ADR 0013) — each is
  sections only, and `src/site/chrome.mjs` composes it onto the home document, whose head,
  contact ask and footer therefore move verbatim into four more Pages. Ten addresses
  ship now, `dist/` is 31 files, and `node --test` is 107.
  Navigation was the first thing the composition could not inherit: the prototype's header
  held five anchor links to Sections of a one-page site (`Company`, `Capabilities`,
  `Platform`, `Industries`, `Approach`), and those Sections are exactly what a Body replaces,
  so all five would have scrolled to nothing on each of the eight new variants. The nav is now
  the route table's four Page links plus the `#contact` ask, and the three dictionary keys and
  one `untranslated.mjs` ledger entry that only those links used went with them — dead keys are refused by
  `sourceProblems`, so this is the one place in the plan where shipping U9 deleted copy.
  `Service` and `BreadcrumbList` arrived as ADR 0011 promised: `serviceNode` names the
  Practice area with the route table's own `name` and points `provider` at the
  `Organization` by `@id` rather than describing the firm twice, and `BreadcrumbList` is on
  the four sub Pages and not on home, because a crumb trail that starts where you are
  standing is noise. `WebPage` gained `mainEntity` (Practice-area Pages) and `breadcrumb`
  pointers so the nodes named in the graph are the ones the graph describes. `WebSite` stays
  on home alone — that count is the assertion, since an exemption written into a test is
  exactly the kind of thing a later edit forgets why it exists.
  The clause (R12) is placed by a slot rather than by prose: `data-od-id="practice-clause"`
  is authored empty in the contact section, because a placement keyed to the sentence beside
  it stops matching in Dutch, where the sentence is translated and the placement is not.
  Two guards hold the "no prose invented yet" promise from the other side. Every visible
  English string on all five live Pages must already be a string the home document says, or
  the clause's own text — a sentence typed into a Body before U10 fails that test by name,
  and it is the line U10 must change deliberately rather than by accident. And a route whose
  `name` stopped matching the dictionary is refused, because the nav now speaks the table's
  words in both variants.

### Stage 3 — words

- **U10.** Draft 400–700 words × 4 Pages (English + Dutch from the same facts), owner's native review, then deploy the sitemap at 10 rows and request indexing (R16, R18).
  **Made 2026-10-23, at U10 (copy shipped, owner's read still open):** the four Bodies carry prose
  now — 83 sentences, in both languages, `var NL` grown to 285 keys, and the sitemap at the ten
  rows R6 expects. `node --test` is 109 and `node tools/wordcount.mjs` reads:
  dataplatforms 677 nl / 697 en, ai-oplossingen 669 / 700, cloud-en-enterprise-software 665 / 699,
  zorg-en-life-sciences 636 / 651. The owner's native Dutch review is the part of this step the
  repository cannot do, and R18's search-console work is the other.
  Three promises the unit had to keep honest, rather than merely fill in. The first is the one
  this line itself set: U9's guard forbade inventing prose, and it did it by requiring every
  visible English string on a Page to be a string the home document already says. That assertion
  cannot survive the copy it was holding back, so it was rewritten to what it always meant —
  a rendered Page may say nothing its own Body did not write, nothing the chrome did not write,
  and nothing but the clause — which is the line U10 changes deliberately, by name, rather than
  by accident (it is now test 62).
  The second is the ledger's. A key that only the home Page speaks is dead, and that is what
  `sourceProblems` used to check; four Bodies now speak keys home never mentions, so the check
  reads the home source together with the four Body sources, and a test proves the sibling list
  is load-bearing rather than decorative: rename a key in a Body alone and the dictionary is
  named as holding something nothing says.
  The third is R16's, and it was wrong before it was measured. The budget was asserted with one
  arithmetic and printed with another, and they disagreed by 93–99 words on all eight variants
  — every Page whose copy passed failing the assertion. The cause is not prose: the home
  document's header comment quotes the brand mark as `<b>Data</b><i>WeGo</i>`, and the test's
  `<[^>]+>` tag-strip stops at the first `>` inside that comment, so its remaining ninety-odd
  words arrive as something a visitor reads. The chrome carries the comment, so all four Pages
  inherit it, and dataplatforms failed at 776 against a budget of 700 with 677 words of prose on
  the page. The Page's own section markers were never involved — `── 4 · PRIJZEN` holds no
  `>` and drops cleanly — which is what let it look like a copy problem as long as it did. The
  arithmetic is now declared once, in `src/site/wordcount.mjs`, called by the guard and by
  `tools/wordcount.mjs` alike: cut at `</head>` rather than pattern-match the whole document,
  drop inline SVG, resolve entities; verified by a Body carrying 31 extra words of comment that
  counts exactly what it counted before. An ai-oplossingen en sits at 700, on the ceiling rather
  than under it — worth knowing before a well-meaning sentence is added.

## Verification Contract

```sh
W=https://www.datawego.nl

# R1/R2  one host, two languages, no JavaScript in the evidence
curl -sI https://datawego.nl/        | grep -qi '^HTTP/2 301'                 # apex redirects
curl -s  $W/en/                      | grep -o '<html lang="[a-z]*"'          # en
curl -s  $W/                         | grep -c 'dataplatform'                 # >0: Dutch in the served HTML
curl -s  $W/                         | grep -c 'mailto:info@datawego.nl'       # 2 — footer and contact block, in the HTML rather than after a script runs
curl -sI https://datawego.pages.dev/ | grep -vi 'x-robots'                    # no header; canonical does the work
curl -sI https://<hash>.datawego.pages.dev/ | grep -i '^x-robots-tag'          # noindex — the platform's own, for a preview alias

# R3/R4  the three places that name an address agree — walked from the sitemap, not compared to one page
for u in $(curl -s $W/sitemap.xml | grep -o '<loc>[^<]*' | cut -c6-); do
  page=$(curl -s "$u")
  printf '%s\ncanonical %s\nhreflang  %s\n' "$u" \
    "$(echo "$page" | grep -o 'rel="canonical" href="[^"]*' | sed 's/.*href="//')" \
    "$(echo "$page" | grep -o 'hreflang="[^"]*" href="[^"]*' | sed 's/.*href="//' | paste -sd' ')"
done   # each address canonicals to itself; both variants list the same pair, x-default last
       # Ten rows since U9, so this walk now covers the four new Pages without being edited —
       # which is the only reason it was worth writing as a loop in the first place.
curl -s $W/sitemap.xml | grep -c '<loc>'                # 10 — five Pages x two variants (R6)
curl -s $W/dataplatforms/ | grep -c 'data-nav='          # 4 — the same nav as every other Page,
                                                        #     from the route table rather than the page
# every fragment link on every address resolves inside the document it stands in (ADR 0013)
for p in "" "en/" "dataplatforms/" "en/data-platforms/" "ai-oplossingen/" "en/ai-solutions/" \
         "cloud-en-enterprise-software/" "en/cloud-and-enterprise-software/" \
         "zorg-en-life-sciences/" "en/healthcare-life-sciences/"; do
  page=$(curl -s "$W/$p")
  for a in $(echo "$page" | grep -oE 'href="#[a-z0-9-]+"' | sed 's/.*="#//;s/"$//' | sort -u); do
    printf '%s#%s -> %s\n' "/$p" "$a" "$(echo "$page" | grep -c "id=\"$a\"")"
  done
done   # every count nonzero. A browser scrolls to an absent id and reports nothing, so this is
       # the R7/R19 class of defect in the one form no curl of a status code can see.

# R7  the defect, gone. The two content-type lines say "not text/html" rather than naming a
#     type: the answer that matters is that the request stopped reaching the homepage.
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' $W/nope-xyz   # 404, with the Dutch 404 page in the body
curl -s -o /dev/null -w '%{content_type}\n' $W/robots.txt              # not text/html
curl -s -o /dev/null -w '%{content_type}\n' $W/sitemap.xml             # not text/html
curl -s  $W/robots.txt | wc -c                     # 611 B (565 authored + the build's Sitemap: line). Measured at the
                                                   # stage-1 deploy: 3,287 B, because Cloudflare's managed content-signals
                                                   # block is still in front of it (Dashboard ②). The claim that matters is
                                                   # unchanged — our 611 B are the tail, and 119039 of homepage is gone.
curl -s  $W/robots.txt | tail -3 | grep -i sitemap # the line whose absence made it a homepage, and ours, not the injected one
curl -s  $W/sitemap.xml | head -1                  # <?xml …

# R8  a Diagram page answers at the address the table declares, noindexed, and saying nothing about the firm
curl -s -o /dev/null -w '%{http_code}\n' $W/docs/pharm-platform      # 200 — the bare address, which is what a Diagram link now says
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' $W/docs/pharm-platform.html   # 308 to it: the file answers, the extension does not (ADR 0005)
curl -s  $W/docs/pharm-platform | grep -c 'noindex, follow'      # 1
curl -s  $W/docs/pharm-platform | grep -c 'application/ld+json'  # 0 — ADR 0011's U7 amendment

# R9/R10  these are the deployment's own words. A file server run over dist/ sends no Cache-Control
#         at all, so nothing here is verifiable before ship; the hashes come from the page, never a
#         copy of them.
curl -sI $W/ | grep -i '^cache-control'                               # public, max-age=0, must-revalidate
for a in $(curl -s $W/ | grep -o 'assets/[a-z0-9._-]*\.\(css\|js\|svg\|png\|jpg\|webp\)' | sort -u); do
  printf '%s ' "$a"; curl -sI $W/$a | grep -i '^cache-control'
done                                                                  # every line ends ", immutable"; not one 404s
curl -s -o /dev/null -w '%{http_code}\n' \
  "$(curl -s $W/ | grep -o 'og:image" content="[^"]*' | sed 's/.*content="//')"   # 200 at the name the page uses
curl -s  $W/    | grep -o 'og:locale" content="[A-Za-z_]*' | sed 's/.*content="//'  # nl_NL
curl -s  $W/en/ | grep -o 'og:locale" content="[A-Za-z_]*' | sed 's/.*content="//'  # en_US

# R19  the requests themselves, read off each page and made as that page would make them. Asking
#      only the Dutch page is how a whole variant of broken images survived Stage 1: / is the one
#      address where a relative path happens to resolve.
for p in "" "en/" "dataplatforms/" "en/data-platforms/" "ai-oplossingen/" "en/ai-solutions/" \
         "cloud-en-enterprise-software/" "en/cloud-and-enterprise-software/" \
         "zorg-en-life-sciences/" "en/healthcare-life-sciences/"; do
  for r in $(curl -s $W/$p | grep -oE '/assets/[a-z0-9._-]*\.(css|js|svg|png|jpg|webp)' | sort -u); do
    printf '%s %s ' "$p" "$r"; curl -s -o /dev/null -w '%{http_code}\n' "$W$r"
  done
done   # every line 200. The ten lists are the same files bar site.<hash>.js, which differs by
       # variant on purpose, and the four Bodies add no artwork of their own — they ask for the
       # chrome's. Stop the name at its extension: a srcset carries " 640w," after each entry, and
       # a pattern that runs to the closing quote asks for that as a URL and reports 000 for a
       # file that was never named.
curl -s $W/en/ | grep -cE '="(assets|docs)/'       # 0 — a request that begins with a name resolves against /en/
curl -s $W/en/ | grep -o 'href="[^"]*docs/[^"]*"' | sort -u   # four absolute bare addresses, not four 404s

# R11  the graph, in the bytes a crawler that runs no JavaScript receives. -A8 because the block
#      opens with @context and @graph; the Organization node is six lines in, and -A3 ends inside it.
curl -s $W/ | grep -A8 'application/ld+json' | grep -q '"@type": "Organization"' && echo PASS
curl -s $W/ | grep -c '"legalName"\|"dateModified"\|LocalBusiness'   # 0 — the refusals in ADR 0011
curl -s $W/ | grep -c '"@type": "WebSite"'                           # 1 — home Pages only
curl -s $W/en/ | grep -c '"@type": "WebSite"'                       # 1
curl -s $W/dataplatforms/ | grep -c '"@type": "WebSite"'            # 0 — the exemption is a count,
                                                                    #     not a comment
curl -s $W/dataplatforms/ | grep -c '"@type": "Service"'            # 1 — named by the route table,
curl -s $W/zorg-en-life-sciences/ | grep -c '"@type": "Service"'    # 0 — an industry Page is not a kind of work
curl -s $W/dataplatforms/ | grep -c '"@type": "BreadcrumbList"'     # 1 on the four sub Pages, 0 on home
curl -s $W/dataplatforms/ | grep -c 'data-od-id="practice-clause"'  # 1 — the clause, once, per Page (R12)

# R15  the build refuses a half-translated page and a dist/ that has fallen behind
node build.mjs --check && echo "dist current"
node --test
node --test tests/contact.test.mjs   # R14's guard: CRLF and `Subject:` through all three slots

# R14  the last mile is the mailbox, and no curl can reach it: send one enquiry from
#      https://www.datawego.nl/ and read its Attribution line. What is asserted above is
#      that a crafted value changes nothing; that a real Google visitor reads
#      `referrer=https://www.google.com` is only answerable in the delivered mail.
```

**Measured at the stage-1 deploy, 2026-10-23:** every line above was run against
`https://www.datawego.nl`, and six facts came back that the file did not hold.
The Diagram pages do not answer at the address the repository declares: Pages 308s
`/docs/<name>.html` → `/docs/<name>` and 308s the trailing-slash form to the same
bare address, so the only 200 is the bare one, and every Diagram link in the nav and
the footer pays a redirect. ADR 0005's `form: "asset"` exception was written from the
`.html` addresses' age rather than from what answers, which is the same class of
mistake the plan cites the reference project for, mirrored. The owner decided the bare
address is the one to declare (R19, ADR 0005's second amendment), which leaves the older
links to the platform's own 308 and takes `-L` out of the R8 lines. Two of the six are the
same mistake in a worse form: the asset references — icons, logo, hero, social card — were
relative, so the English homepage asked for `/en/assets/logo…` and got 404 for its own logo
and every hero width, and the four Diagram links, hand-written as `href="docs/<name>.html`,
answered 404 for the evidence of every Practice area shown in English. Neither was visible
to any assertion above, because each one reads the Dutch page, where a relative path is
right by accident of the root. `robots.txt` arrives as 3,287 B with Cloudflare's managed
content-signals block in front of our 611 B, which also gives that file its own
`max-age=14400` rather than the `/*` line (Dashboard ②). The apex still answers 200
instead of 301 (Dashboard ①). And the served pages do not carry the `mailto:` links this
build wrote: Cloudflare's Email Address Obfuscation rewrites both of them into
`/cdn-cgi/l/email-protection#…` and adds `email-decode.min.js`, so the address exists for a
reader only after JavaScript runs. It leaves the graph's `"email"` alone, because the feature
rewrites anchors rather than JSON strings, and it is a Scrape Shield toggle rather than
anything in this repository (Dashboard ⑥). And Dashboard ③ needed nothing: an unknown path is
already 404 with the Dutch page, so Pages' not-found behaviour was never pinned to
`index.html` — the assumption is closed. Everything else above passed as written: the
canonical/hreflang walk, the two content-types, the header block on `/*` and on all
eleven named assets, `og:image` at its hashed URL, and the graph's four counts.

**Made 2026-10-23, at U7:** every line here was run against a file server over `dist/` before it
was trusted, which corrected four things. The sitemap walk replaces a `comm` of `loc`s against one
page's canonical: at two addresses that comparison is unequal by construction, and its
`cut -d'"' -f3` selected the literal string ` href=` rather than a URL, so it had never asserted
anything at all. The graph grep is `-A8` because the block opens with `@context` and `@graph` and
the `Organization` node's `@type` is six lines in — `-A3`, the window it replaces, matches nothing.
The two content-type lines decline to name a type, because the claim worth making is "this stopped
being the homepage", not "text/plain". And the R9/R10 header block is deploy-only: a static server
over `dist/` sends no `Cache-Control` whatsoever, so those lines are the deployment's words, not
the build's.

**Made 2026-10-23, at the redeploy that fixed them:** the whole contract, R19 included, passed on
`https://www.datawego.nl` with only the owner's four rows outstanding — ① apex still 200, ② still
3,287 B, ⑥ still rewriting both `mailto:` into `/cdn-cgi/l/email-protection#…`, and ③ needing
nothing. Both pages name eleven assets and all twenty-two requests answer 200; `/en/` asks for
`site.ad853e2daaeb.js` where `/` asks for `site.fd23787b0076.js`, which is the variant split doing
its job rather than a defect, and the two lists are otherwise the same files. Each page's four
Diagram links are now absolute bare addresses, and all four answer 200 with `noindex, follow` and no
`application/ld+json`, while `.html` and the trailing-slash form both 308 to the bare one — the
table's word is now the platform's word. Running the contract is also what found a flaw in the
contract itself: R19's first form grepped to the closing quote, so a `srcset` handed it `640w,` as a
URL and it reported `000` for a file nobody named. Fixed above. `dist/` still matches the source at
23 files, 3,758.7 KB, and 102 tests pass.

**Made 2026-10-24, at the U10 deploy:** the copy is live — `193feb3` shipped as `a273f6aa`, 31
files and 3,942.9 KB, 109 tests, `dist/` matching the source. On the shipped bytes: 98 asset
requests and every one 200, no request written as a bare name, Diagram links absolute (the four
home points at, the two `dataplatforms` points at, the one `zorg` points at), every `#fragment` on
all ten addresses resolving inside the document that carries it, canonicals self-refer with
nl/en/x-default listed in the same order everywhere, and the graph reading Organization 1, WebSite
on home alone, Service on the three kinds of work and not on the industry Page, BreadcrumbList on
the four sub Pages, the clause once per Page, the nav four links from the table. The preview alias
still answers `x-robots-tag: noindex`.

The owner's three rows are unchanged since the last deploy — ① apex still 200, ② robots.txt still
3,287 B, ⑥ still rewriting both addresses — and ⑥ picked up a consequence worth knowing before it
is read as cosmetic. Email obfuscation rewrites the *link text* as well as the `href`, and
`[email protected]` is two words where `info@datawego.nl` was one. A Page carries that address
twice, so every variant ships two words heavier than the file the build wrote: `dataplatforms.nl`
counts 679 served against 677 in `dist/`. For six of the eight variants that is a rounding error
and nothing more. Two were authored at 700 and 699, so those two cross R16's ceiling as served
— 702 and 701 — while passing the guard in the repository. R16 is a budget about what a visitor
reads, so the copy is not what is wrong here; but it is why ⑥ is now the most expensive row on this
list, and it stays expensive for as long as any Page sits within two words of 700. Turning it off
is the whole fix. The sentence this note originally closed with cited R2 and ADR 0011 for what
that fixes, and both citations were wrong; the corrected claim is in the note below, and so is
the check that could never have proved it.

Running the contract caught a flaw in the contract a second time: an asset walk written as
`grep -o '/assets/[A-Za-z0-9._-]*'` finds `/assets/template.html` inside the header comment and
reports a 404 for a file no page asks for. The form above filters by extension, which cannot match
that string, and `template.html` is genuinely absent from `dist/assets/` — but the lesson is the
same one R19's `64w,` taught: a mechanical check that reads the document rather than its attributes
will eventually assert about a comment.

**Made 2026-10-24, at the deploy that fixed three Dutch word-forms:** `95f2c7b`, shipped as
`cae3e568`. It moved no word: `677 / 669 / 665 / 636` in Dutch and `697 / 700 / 699 / 651` in
English, the same figures as the note above, and a served Page differs from the file the build
wrote in three places — two rewritten anchors and one injected script — 424 lines against 424.
Reading those bytes again found two things the rows below now say better.

**② is not a size problem.** Split at the line where our file begins, and parse the response as
groups rather than as `grep` output — the lesson this contract has now been taught a third time —
the injected block and ours disagree in exactly one place: a `GoogleOther` group at line 77 that
refuses it at line 78, and ours at line 151 that welcomes it at 152. Six of the seven crawlers we
refuse are refused by the injected block too; `FacebookBot` is the seventh, unnamed there, which
costs nothing. Neither file names `Googlebot` at all, so the `User-agent: *` / `Allow: /` both of
them carry governs it, and nothing here threatens the Dutch index. What it threatens is the
AI-answer channel ADR 0007 opened on purpose, because a crawler that merges the groups that match
it takes the restrictive rule and never reaches our line. So row ② is not finished at 611 bytes;
it is finished when no `GoogleOther` group in the response says `Disallow`.

**⑥ costs something smaller than the note above claims, and adds a request.** Both anchors become
`/cdn-cgi/l/email-protection#…` and their link text becomes `[email&#160;protected]`, so on the
served Page `grep -c 'mailto:info@datawego.nl'` answers 0 where `dist/` holds 2 — that is the
assertion under R1/R2 that this feature breaks, and it is the only one. The graph's `"email"` is
left alone, as the earlier note already said, so a crawler running no JavaScript still finds the
address; what loses it is a visitor, who can neither read it, copy it, nor tap it. It also ships
`email-decode.min.js`, 1,239 B no build wrote. And the check written into row ⑥ to prove all of
this searched for `[email protected]` with a space, which the bytes never contained: it answered
0 with the row open and would answer 0 with the row closed, and so proved nothing. Replaced below
with the `&#160;` form, which answered 2 that day and answers 0 now — read the note that follows
before touching anything in this row.

**Read again 2026-10-25, and one of those two findings is now the site's own.** Everything below
was measured with the owner's API token, which carries `#zone:read` and nothing else: every
`/zones/{zone}/settings/…`, `/pagerules` and `/rulesets` read answers 9109 or 10000, so this
repository cannot see a single dashboard value and the rows were rewritten from what the bytes
do and do not do, checked against Cloudflare's own pages.

**⑥ turned out to cost nothing.** Twelve repeat requests, the apex, the `*.pages.dev` address and
all ten sitemap URLs return the build's bytes unchanged — `sha256(served) == sha256(dist)` ten
times over, `mailto:info@datawego.nl` twice per Page, `__cf_email__` and `email-decode.min.js`
nowhere, `content-encoding: br` intact so nothing is asking for `no-transform`. The note above
that says the served Pages "do not carry the `mailto:` links this build wrote" is therefore not
true of the site as it answers today, and the word-count consequence it draws — 679 against 677,
and two variants crossing R16 at 702 and 701 — does not appear in any byte this measurement
touched. Cloudflare's page on the feature says both halves of that are normal: it is on by
default, and it does not apply to HTML "specifically added by a Worker", which is how Pages
answers. So row ⑥ asks for nothing, `<!--email_off-->` is not needed, and the only live risk is
a future Cloudflare change, which the `mailto:` assertion already in `dist/` would catch.

**② is the whole of the remaining robots.txt work, and it has one switch.** The managed block
arrives whatever the requester claims: 3,287 B for `Mozilla/5.0`, `Googlebot/2.1`,
`Google-Extended`, bare `curl` and an empty User-Agent alike, so Google reads the `GoogleOther`
refusal exactly as a retrieval crawler does. Cloudflare's robots.txt page (updated 2026-10-22)
names the condition precisely: managed directives are prepended **only while `Enable Bot
Preference Sync` is on and at least one Search / Agent / Training policy is Block or Disallow**,
and "with every policy set to allow, there is nothing to prepend and your robots.txt is served
unchanged". Since ours is not served unchanged, Sync is on. The row below used a door that does
not exist; the real one is the `Enable Bot Preference Sync` toggle inside `Configure AI bot
policies`, and the same page promises the effect "within a few seconds" with no cache purge,
which is what makes 611 B the check rather than a reload ritual.

**① and ② closed the same day.** Both owner rows above were executed and re-measured on the live
network: ② first, then ①, and the ten URLs walked again between the two. What the walk proved is
that nothing moved underneath — 10/10 still `sha256(served) == sha256(dist)`, `mailto:` twice per
Page, the 404 still Dutch (`Pagina niet gevonden`, 3,069 B) — so the two rows are the whole of the
dashboard's effect on this site, and ⑥'s absence from that list is now a measured fact rather
than an expectation. Only ④ and ⑤ remain, and neither is a Cloudflare setting.

## Dashboard Checklist (owner — the agent can only verify the effect)

| # | Where | Do | Verified by |
|---|---|---|---|
| ① | Cloudflare zone → Rules → **Redirect Rules** → Create rule | **DONE 2026-10-25.** Rule `apex → www (301)`: Request URL `http*://datawego.nl/*` → Target URL `https://www.datawego.nl/${2}`, 301, *Preserve query string* ticked. **`${2}`, not `${1}`** — the `http*` half of the pattern is the first wildcard, so a `${1}` target redirects every address on the apex to the bare homepage. Verified as deployed: `https://datawego.nl/`, `/dataplatforms/`, `/en/healthcare-life-sciences/`, `/robots.txt`, `/nope-404/` and plain `http://datawego.nl/dataplatforms/` each answer 301 in **one hop** with path and `?gclid=` intact; `www` and the `*.pages.dev` alias still answer 200 with no bounce, so the rule did not capture the host it redirects to. R2's "www is the only host that answers" is now true of the network rather than only of the canonical | `curl -sI https://datawego.nl/ \| grep -i '^location'` → `https://www.datawego.nl/` — **done: it does** |
| ② | Cloudflare zone → Security → **Settings** → filter *Bot traffic* → `Configure AI bot policies` → **`Enable Bot Preference Sync`** | **DONE 2026-10-25** — Sync switched off, the three policies left alone. `robots.txt` now answers 611 B with `sha256(served) == sha256(dist/robots.txt)` (`df38cbb2159e98fc`), identical to `Mozilla/5.0`, `curl` and an empty User-Agent alike, and `GoogleOther` is back to `Allow: /`, which is what ADR 0007 asked for. The 130 managed lines and the `Content-Signal` line are gone, so nothing in the response contradicts anything in ours | `curl -s $W/robots.txt \| wc -c` → 611 **and** `curl -s $W/robots.txt \| awk '/^User-agent: GoogleOther$/{getline; if ($0 ~ /^Disallow/) print "still refused at line " NR}'` → empty — **both do now** |
| ③ | Cloudflare Pages → Settings → Build & functions / not-found behaviour | must **not** force `index.html`; `404.html` answers | unknown path → 404 |
| ④ | Google Search Console | **Verified 2026-10-25** as a Domain property `datawego.nl` (`sc-domain:datawego.nl`) — and the record was **not** pasted by hand: Search Console recognised Cloudflare as the domain provider and wrote the TXT into the zone itself, Google's "for some domains, Google can add the record for you" path. Where that integration is absent, the fallback is one **TXT record on the apex itself** — name blank or `@`, value `google-site-verification=<token>` — added **as its own record, never appended to the SPF line, which must stay a single `v=spf1` string**; verifying the root covers `www` and every other subdomain, which is why one record is enough here. The name this row used to give, `_googlehosted.datawego.nl`, was never a record Google asked for: a mangled `dv.googlehosted.com`, which is the *target of the CNAME alternative*, and the CNAME route is not ours — Google uses it only where the property's host CNAMEs to a parent domain, and `www` points at `datawego.pages.dev`, which is not a parent of `datawego.nl`. Remaining here: submit the sitemap, then request indexing for the ten live addresses | `dig +short TXT datawego.nl` → three records, one of them `google-site-verification=…` — TXT order is not stable across resolvers (the zone's own servers answer it first, `@8.8.8.8` second), so match on content, not position — and GSC → Ownership verification → "You are a verified owner" — **it does, and it says so** |
| ⑥ | Cloudflare zone → Security → Settings → filter *Client-side abuse* → Email Address Obfuscation | **Nothing to do.** It is on by default and it does not rewrite this site's HTML, because Pages answers through a Worker (see the note above), so all ten addresses ship both `mailto:` links intact. This row stays here as the tripwire: if a future deployment starts shipping `[email&#160;protected]`, the fix is this toggle off, not `<!--email_off-->` in the source | `curl -s $W/ \| grep -c 'mailto:info@datawego.nl'` → **2** and `curl -s $W/ \| grep -c 'cdn-cgi/l/email-protection'` → **0** (both true today) |
| ⑤ | Bing Webmaster Tools | **File authentication, served 2026-10-25 — not the import route this row planned.** Bing's add-and-verify page offers four methods and the XML one says to "upload the file to the root directory of the registered site"; Pages has no root to upload into — root is what the build writes (ADR 0003). So the file moved from the owner's downloads to `src/BingSiteAuth.xml` and `staticAssets` gained its fifth not-a-page entry (`c097aa4`, 110 tests): the guard passes the issued bytes through and refuses any hand-edit under this name — lowercased key, comment, or a second `<user>` beside ours, because the issued file carries exactly one. Measured as served: `https://www.datawego.nl/BingSiteAuth.xml` 200 direct, the apex 200 after one 301 hop (①'s rule, path preserved), three addresses one `sha256 == src` (`28197e2d…`), `application/xml`. The value is a user-level ownership code the checker fetches in place — public by the route's own instruction, and not the URL-submission API key, which lives separately under Settings → API Access. **Remaining: click Verify.** If the site was registered under the apex and the checker does not follow its one redirect, add `https://www.datawego.nl/` instead — there the file answers with no hop. After it verifies, submit the sitemap here too: importing would have carried it over, file authentication does not (ChatGPT retrieval leans on the Bing index — ADR 0007 welcomes those crawlers) | click **Verify** → green check; `curl -sL https://datawego.nl/BingSiteAuth.xml \| sha256sum` → `28197e2d…` — **it does now** |

**④ verified the same evening, by a route this row did not predict.** The record appeared in the
zone before anyone read this row, because Search Console recognised Cloudflare as the domain
provider and added the TXT itself. The value Google wrote —
`google-site-verification=VKb4j5gTQunYHRWjup9WDZT6dIHiWCh09szkUyhgnPE` — is a permanent asset of
the zone from now on: Google's instructions are explicit that it stays after verification, and
deleting it drops ownership. It is public by design, a lookup key and not a credential — knowing
it grants nothing — and the check that proved it published rather than merely saved was
`dig +short TXT datawego.nl` answering three records where it had answered two. One more thing the
next step will notice: the sitemap Google fetches carries ten `<loc>` and no `<lastmod>`, which is
`src/site/static.mjs`'s deliberate omission rather than an oversight, guarded by its own test.

## Definition of Done

Dutch prose is in the served HTML of `/` and counts as a real page to Google, Bing and a retrieval crawler; one address per variant answers at www with a matching canonical, sitemap and hreflang set; an unknown URL says 404 in Dutch; `robots.txt` is 611 bytes and names the sitemap; `dist/` cannot be stale and a page cannot be half-Dutch without failing the build; the hero and logo cost under a tenth of what they cost today; and an Organic enquiry is identifiable in the mailbox by its `Attribution:` line.

## System-Wide Impact

`README.md:10` ("No build step") becomes wrong and is rewritten; `docs/DESIGN-HANDOFF.md:46`'s self-containment clause is now conditional on a single screen and the site has five; `deploy.js` grows a build phase and starts copying `dist/assets`; `functions/api/_contact.js` gains one allowlisted field; the runtime dictionary moves from shipped bytes to build input, which is why the per-page JS roughly halves; and the site's language of record for external claims is Dutch, so `CONTEXT.md` is where a future reader learns that "Werkvelden", `Dataplatforms` and `zorgteams` are load-bearing words, not translations.
