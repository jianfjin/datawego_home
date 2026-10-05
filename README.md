# DataWeGo — Company Website Prototype

A single-page, self-contained website prototype for **DataWeGo**, a Dutch data
engineering & AI consulting company building AI-powered data platforms for
healthcare, life sciences and enterprise innovation
([datawego.nl](https://www.datawego.nl)).

## Quick start

No build step — it is one HTML file with inline CSS and JS.

- **Open directly:** double-click `datawego-company-site.html`, or
- **Serve locally** (recommended so assets and storage behave like production):

  ```sh
  python -m http.server 8000
  # then visit http://localhost:8000/datawego-company-site.html
  ```

## Project structure

```
├── datawego-company-site.html   # the whole site: markup, design tokens, styles, scripts
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

## Implementation notes

`docs/DESIGN-HANDOFF.md` is the source of truth for porting this prototype to
production code: preserve tokens, geometry, copy, interaction states, and
accessibility semantics rather than reinterpreting them. All imagery is
project-local (`resources/`) — no remote hotlinks.

## Repository housekeeping

`.gitignore` excludes OS/editor junk, local archives, and DSH tooling
artifacts (e.g. `.acl-recovery/`). The folder is not a git repository yet;
run `git init` when you want to start versioning it.
