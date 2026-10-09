# DataWeGo — Company Website Prototype

A single-page, self-contained website prototype for **DataWeGo**, a Dutch data
engineering & AI consulting company building AI-powered data platforms for
healthcare, life sciences and enterprise innovation
([datawego.nl](https://www.datawego.nl)).

## Quick start

No build step — the site is one HTML file with inline CSS and JS. The contact
form is the single part that needs a server: it posts to a Cloudflare Pages
Function in `functions/`, and a page opened straight from disk has no origin for
that request to come from.

- **Read the page:** `python -m http.server 8000`, then
  `http://localhost:8000/datawego-company-site.html`. Everything works except
  sending, which the page says so about.
- **Work on sending:**

  ```sh
  cp .dev.vars.example .dev.vars   # fill in the local values; .dev.vars is never committed
  node deploy.js --skip-deploy     # assemble dist/ — HTML, resources/, diagrams, _routes.json
  npx wrangler pages dev           # http://localhost:8788 — page and Function together
  node --test                      # the endpoint's guard tests
  ```

  `wrangler.toml` tells wrangler where `dist/` is and which KV namespace to bind,
  so the command needs no arguments.

## Project structure

```
├── datawego-company-site.html   # the whole site: markup, design tokens, styles, scripts
├── functions/                   # Cloudflare Pages Functions — the server side
│   └── api/
│       ├── contact.js           #   POST /api/contact, the only route it owns
│       └── _contact.js          #   shared guards; an underscore file is not a route
├── tests/contact.test.mjs       # node --test over those guards
├── wrangler.toml                # Pages config: dist/ as the output, the KV binding
├── deploy.js                    # assembles dist/, then deploys (--skip-deploy assembles only)
├── dist/                        # what actually gets uploaded — assembled, never edited
├── resources/                   # brand imagery (banner + logo variants)
│   ├── DataWeGo_banner.png      #   hero banner
│   ├── DataWeGo_Logo.png        #   footer brand mark
│   └── DataWeGo_Logo-1..5.png   #   unused logo variants kept for reference
└── docs/                        # design-handoff material
    ├── DESIGN-HANDOFF.md        #   implementation contract (fidelity, responsive matrix)
    └── DESIGN-MANIFEST.json     #   machine-readable map of screens, tokens, interactions
```

## Features

- **Design system:** Apple-style design tokens (`--bg`, `--fg`, `--accent`,
  spacing, type scale, radii, motion) declared verbatim in `:root`.
- **Light / dark theme:** toggle in the nav bar; choice remembered in
  `localStorage["datawego-theme"]`, resolved before first paint (no flash).
- **Bilingual EN / NL:** English is the authored markup; Dutch is applied at
  runtime from the NL dictionary in the closing script. EN/NL control lives in
  the nav bar, remembered in `localStorage["datawego-lang"]`, defaulting to the
  browser language.
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

## Implementation notes

`docs/DESIGN-HANDOFF.md` is the source of truth for porting this prototype to
production code: preserve tokens, geometry, copy, interaction states, and
accessibility semantics rather than reinterpreting them. All imagery is
project-local (`resources/`) — no remote hotlinks.

## Repository housekeeping

The folder is a git repository; deploy from a branch you intend to ship, since
`deploy.js` pushes the production branch.

`.gitignore` excludes OS/editor junk, local archives, DSH tooling artifacts
(e.g. `.acl-recovery/`), the assembled `dist/`, wrangler's local state in
`.wrangler/`, and `.dev.vars`. No credential value belongs in this history —
`git log --all -- .dev.vars` staying empty is the check that says so.
