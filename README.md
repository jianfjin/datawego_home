# DataWeGo — Company Website Prototype

A two-language, Dutch-first company site for **DataWeGo**, a Dutch data
engineering & AI consulting company building AI-powered data platforms for
healthcare, life sciences and enterprise innovation
([datawego.nl](https://www.datawego.nl)).

## Quick start

The site is authored in one HTML file and built from it: `node build.mjs`
generates the language variants into `dist/`, and `node build.mjs --check` proves
`dist/` still says what the source says. That file is the home Page, and it is
also the chrome — its head, header, closing ask and footer are lifted into the
four other Pages, which are authored as Bodies (sections only) under `src/pages/`
(ADR 0013). A generated page links its stylesheet and its behaviour as shared
files rather than carrying them inline, so it is the authored file that stays
self-contained. The contact form is the single part that needs a server: it posts
to a Cloudflare Pages Function in `functions/`, and a page opened straight from
disk has no origin for that request to come from.

- **Read the design:** `python3 -m http.server 8000`, then
  `http://localhost:8000/datawego-company-site.html`. Every colour, spacing and
  interaction is in that one file, and it is the file a person edits by hand.
  What is *not* there are the addresses: the eight links the route table owns
  (the four navigation links and the four Diagram links) are written as
  `{{LINK:…}}` tokens, so on this page they go nowhere until the build fills
  them. Sending is the other thing that cannot work from disk, which the page
  says so about.
- **Read the site:** `node build.mjs && cd dist && python3 -m http.server 8000`,
  then `http://localhost:8000/`. `/en/`, `/dataplatforms/` and the rest are the
  other nine addresses, all answered, because Pages' directory index is what the
  route table's trailing slash means on disk.
- **Work on sending:**

  ```sh
  cp .dev.vars.example .dev.vars   # fill in the local values; .dev.vars is never committed
  node deploy.js --skip-deploy     # generate dist/ — both variants, the chrome, diagrams,
  #   robots.txt, sitemap.xml, 404.html, _headers, _routes.json, and the artwork
  #   the pages ask for
  python3 tools/derive-images.py   # re-derive hero widths, icons and the social card,
  #   by hand, when the brand artwork under resources/ changes
  npx wrangler pages dev           # http://localhost:8788 — page and Function together
  node --test                      # the endpoint's guards, the route table, the build
  ```

  `wrangler.toml` tells wrangler where `dist/` is and which KV namespace to bind,
  so the command needs no arguments.

## Project structure

```
├── datawego-company-site.html   # the home Page source *and* the chrome: markup, styles, scripts, NL dictionary
├── build.mjs                    # the only writer of dist/; --check proves dist/ is current
├── src/                         # the generator's input, all of it
│   ├── robots.txt               #   the crawler-facing stance, authored rather than inherited (ADR 0007)
│   ├── 404.nl.html              #   the page behind an unknown address, in Dutch (R7)
│   ├── pages/                   #   the other four Pages, as Bodies: sections, no chrome (ADR 0013)
│   │   ├── dataplatforms.html
│   │   ├── ai-oplossingen.html
│   │   ├── cloud-en-enterprise-software.html
│   │   └── zorg-en-life-sciences.html
│   └── site/                    # what the generator reads, and what it is not allowed to invent
│       ├── routes.mjs           #   every address, declared once (ADR 0005)
│       ├── company.mjs          #   every company fact, declared once (ADR 0011)
│       ├── page.mjs             #   one source in, one address out: retirement, translation, chrome
│       ├── chrome.mjs           #   the home document edited into every other Page, by anchor (ADR 0013)
│       ├── pages.mjs            #   which Body is which Page's, and the sentence each one's is about
│       ├── static.mjs           #   the four files that are not pages, derived from the two above
│       ├── diagrams.mjs         #   the Diagram pages' titles and descriptions, which archify would overwrite
│       ├── graph.mjs            #   the structured data, every value read out of the modules above
│       ├── dictionary.mjs       #   the source's `var NL`, read as build input
│       ├── markup.mjs           #   the tag-stack walker the translation splices into
│       └── untranslated.mjs     #   the ledger: the English the Dutch page is allowed to show
├── functions/                   # Cloudflare Pages Functions — the server side
│   └── api/
│       ├── contact.js           #   POST /api/contact, the only route it owns
│       └── _contact.js          #   shared guards; an underscore file is not a route
├── tests/                       # node --test over the endpoint's guards, the routes, the build
├── wrangler.toml                # Pages config: dist/ as the output, the KV binding
├── deploy.js                    # runs the generator, then deploys (--skip-deploy generates only)
├── dist/                        # what actually gets uploaded — generated, never edited
│   ├── index.html               #   the Dutch address: the root is Dutch (ADR 0001)
│   ├── en/index.html            #   the English one
│   ├── <key>/index.html         #   the four new Pages, Dutch at the address the table declares
│   ├── en/<slug>/index.html     #   …and their English variants, English slugs and all
│   ├── robots.txt               #   the stance above, plus the Sitemap: line only the build knows
│   ├── sitemap.xml              #   every live indexable variant, read off the route table (R6)
│   ├── 404.html                 #   so an unknown address is a 404 in Dutch, not the homepage (R7)
│   ├── _headers                 #   HSTS, immutable chrome, and never an X-Robots-Tag (ADR 0006, R9)
│   ├── docs/                    #   the four Diagram pages: their drawings, this repository's head (ADR 0002)
│   ├── assets/                  #   chrome *and* artwork, every file named by its contents
│   └── (no resources/)          #   what no page asks for is not uploaded
├── tools/
│   └── derive-images.py         # brand artwork in, shipped artwork out; run by hand, never by the build
├── resources/                   # the authored originals, and what derives from them
│   ├── DataWeGo_banner3.png     #   the hero's source art: 2056x491, 1.4MB, never shipped
│   ├── hero-{640,1028,1542,2056}.webp  # the four widths a browser chooses between (R10)
│   ├── DataWeGo_Logo.png        #   the footer mark's source art: 1536x1024, 1.3MB, never shipped
│   ├── logo.svg                 #   the mark it became: 1.2KB, and the same drawing as the icon
│   ├── favicon.svg              #   the mark on a plate, for the tab and any reader that asks for SVG
│   ├── favicon-32.png           #   rasterised from the SVG, for the readers that cannot
│   ├── apple-touch-icon.png     #   ditto, 180, because iOS wants a square with no transparency
│   ├── og-image.jpg             #   1200x630 social card: the brand band over the mark
│   └── DataWeGo_banner{,1,2}.png, DataWeGo_Logo-1..5.png, datawego1.png,
│       Developer_Desk_with_Erasmus_Bridge_View.png  # kept for reference; no page names them
└── docs/                        # what the site is built from that is not code
    ├── pharm-platform.html      #   the four Diagram pages, exactly as archify exported them;
    │                            #   the build serves these bytes and writes their heads
    ├── etl-dataflow-with-prepass.html
    ├── marketing-research-swarm.html
    ├── ehr-platform-architecture-with-prepass.html
    ├── adr/                     #   the decisions, one file each (0001-0013)
    ├── plans/                   #   the plans those decisions were taken in
    ├── DESIGN-HANDOFF.md        #   implementation contract (fidelity, responsive matrix)
    └── DESIGN-MANIFEST.json     #   machine-readable map of screens, tokens, interactions
```

## Features

- **Design system:** Apple-style design tokens (`--bg`, `--fg`, `--accent`,
  spacing, type scale, radii, motion) declared verbatim in `:root`.
- **Light / dark theme:** toggle in the nav bar; choice remembered in
  `localStorage["datawego-theme"]`, resolved before first paint (no flash).
- **Bilingual NL / EN:** both languages are generated, not swapped in the
  browser. Dutch owns the root address and English lives at `/en/`, each with its
  own canonical and an `hreflang` pair pointing at the other, and the language
  control is two links rather than a button that mutates the page (ADR 0001,
  ADR 0003). The NL dictionary in the closing script is build input now: a
  visible string with no Dutch key fails the build instead of quietly falling
  back to English.
- **Responsive:** fluid `clamp()` type/spacing with semantic breakpoints;
  validate against the viewport matrix in `docs/DESIGN-HANDOFF.md`.
- **Sections:** hero + brand banner, company profile, capabilities,
  data-lifecycle flow, reference architecture, industries, approach,
  principles, contact brief, footer.

## The contact form

**Prepare my brief** composes the summary in the page and asks nothing of the
network. **Send enquiry** is the moment it leaves: the page posts the brief plus
a Turnstile confirmation to `/api/contact`, and the Function there names the
recipient — `info@datawego.nl` — and hands the enquiry to Resend. A visitor
cannot aim the send anywhere else, and a `mailto:` link survives only as the way
out of a failed send, never as the path a normal enquiry takes.

That is the whole fix for "the message cannot be sent": the form used to end in
`mailto:`, which on a machine with no configured mail client opened an external
handler and delivered nothing.

What the endpoint needs from the project (Cloudflare → Workers & Pages →
datawego → Settings):

| Name | Kind | What it is for |
| --- | --- | --- |
| `RESEND_API_KEY` | secret | the send itself, restricted to the datawego.nl domain |
| `TURNSTILE_SECRET` | secret | confirming the human check, request by request |
| `CONTACT_FROM` | variable | the sender shown on every enquiry |
| `CONTACT_RATE_LIMIT` | KV binding | five accepted sends per visitor IP per minute |

Locally the first three live in `.dev.vars` and the binding is read from
`wrangler.toml`. Two things worth knowing before a local send looks like a bug:
`TURNSTILE_SECRET` has to be the widget's real secret key — Cloudflare's
always-pass test pair answers with hostname `example.com`, which the endpoint
rejects because a confirmation must name the host that served the page — and the
cap can only answer 429 once the binding is attached, since an unattached one
lets traffic through rather than blocking it.

`datawego.pages.dev` must also be an authorized hostname on widget
`0x4AAAAAAE_LDKoiHQlhtMM2`, alongside `datawego.nl` and `localhost`.

**What the mailbox learns about how an enquiry arrived.** Each enquiry carries one
`Attribution:` line (`referrer=… page=… variant=…`), built by the page and read off
the document rather than written out in code: an origin, the address the brief was
filled in on, and the variant the visitor read (ADR 0010). That line is the whole
measurement plan — no analytics, no consent banner — which is why its three values
are validated one at a time and land in the message body and nowhere else. A part
the Function cannot parse is printed as `unknown`; an odd referrer never refuses an
enquiry somebody wrote. `tests/contact.test.mjs` sends CRLF- and `Subject:`-carrying
values through all three slots and asserts the delivered request is byte for byte
the request of an unattributed enquiry.

## Implementation notes

`docs/DESIGN-HANDOFF.md` is the source of truth for porting this prototype to
production code: preserve tokens, geometry, copy, interaction states, and
accessibility semantics rather than reinterpreting them. All imagery is
project-local — no remote hotlinks.

**What an image costs, and who decides.** A page asks for artwork in an
attribute; `build.mjs` reads those requests, copies the bytes into
`dist/assets/<name>.<contents>.<ext>` and rewrites the request to the new name, rooted, so the same file is what the request means from `/en/` as from `/` (R19).
Three things follow. A file no page asks for is never uploaded — `resources/`
holds 15.7MB and eleven of its files, six of them identical copies of the same
footer PNG, were shipping to nobody. A file a page does ask for had better exist,
or the build refuses and says to run `tools/derive-images.py`. And every shipped
image is named by what it contains, which is the only reason `/assets/*` may
promise `immutable` (ADR 0004, R9) — replacing the banner is a new URL, not a
year of cache to purge.

Prose does not count as a request. The page's own comment says the hero WebP
files were derived from `resources/DataWeGo_banner3.png`, and that sentence used
to be a 1.4MB file on the strength of itself.

**What the machine-readable version says.** One
`<script type="application/ld+json">` per Page variant, built from `company.mjs`
and the route table and never typed into a page (ADR 0011): an `Organization`
carrying the KvK number, the email, Den Haag at city level and the LinkedIn; a
`WebSite` that describes the site once, for both languages; and a `WebPage` whose
`@id` *is* the canonical beside it, so the two cannot name different addresses.
What is not in it was decided as carefully as what is: no `legalName`, because an
eenmanszaak's statutory name is a person and the site names nobody; no `Person`; no
`LocalBusiness` or `ProfessionalService`, which are the map pack's instrument and
the firm declined the map pack; no `dateModified`, not even a build timestamp,
because that is a page claiming it was edited today; and no street, so the graph
cannot disagree with the page or with a Profile that does not exist.
`tests/seo-graph.test.mjs` walks the emitted JSON and refuses any of those keys for
appearing at all rather than for being empty — `"telephone": null` is a sentence.

**Five Pages, one header.** The home document is composed rather than copied
(ADR 0013): `src/site/chrome.mjs` lifts its head, closing ask and footer into the
four Bodies verbatim, replaces its `<main>`'s sections with the Body's own, and
rewrites the navigation from the route table. Composition is anchored to strings
the document has to contain anyway — `<main id="content">`, the section-9 comment,
`<nav id="primary-nav">` — and an anchor that has moved, or gone, or appeared
twice fails the build by name rather than shipping a page whose contact form was
eaten (R15). Two things a person editing the prototype should know. Deleting the
home Page's contact section deletes the edge of every other Page's chrome. And a
link to `#industries` in a Body becomes `/…#industries`, because with five Pages
that anchor means the sixth section of *whichever page you are standing on*, and a
browser scrolls to an absent `id` without telling anyone (R7's failure shape in a
form no status code reveals).

**Who owns a Diagram page.** The four files under `docs/` are archify's export,
and re-exporting a drawing rewrites the whole document. So the build hands the
body over byte for byte and writes the head itself — the title, the description,
`noindex, follow` and the icons come from `src/site/diagrams.mjs`, which is the
only place in the repository allowed to say what a Diagram page is about. Typed
into `docs/pharm-platform.html` instead, it would last until the next
regeneration; two of the four titles that shipped today are the exporter's own
guess, and one of those is still a Python module name. The head gains no
`rel=canonical`, deliberately: a canonical says index this address and a noindex
says index neither, and Google asks that the two not be combined. It costs about
half a kilobyte per page on a document that is 0.8MB of inline drawing already
(ADR 0002, R8).

**An address is not the file.** A Diagram page's address is `/docs/<name>` and its file is
`docs/<name>.html`, and Cloudflare Pages answers the bare address while redirecting the
extension to it. The route table declares the address, `build.mjs` says which file answers
it, and the page links the address through a token the table fills in. The older spelling is
not forgotten, only not repeated: it arrives at the same drawing by way of the platform's own
308, and it would cost a redirect per click to keep naming it here (ADR 0005, R19).

## Repository housekeeping

The folder is a git repository; deploy from a branch you intend to ship, since
`deploy.js` pushes the production branch.

`.gitignore` excludes OS/editor junk, local archives, DSH tooling artifacts
(e.g. `.acl-recovery/`), the assembled `dist/`, wrangler's local state in
`.wrangler/`, and `.dev.vars`. No credential value belongs in this history —
`git log --all -- .dev.vars` staying empty is the check that says so.
