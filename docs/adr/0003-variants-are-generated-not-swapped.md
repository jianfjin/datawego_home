# Language variants are generated at build time, not swapped at run time

The site has no build step: `deploy.js` copies `datawego-company-site.html` to
`dist/index.html`, and Dutch arrives in the browser as a 22.3KB dictionary of
206 exact-string keys, applied by `renderLang`. That mechanism holds up
surprisingly well on content — measured against the page's own visible strings,
only three prose fragments lack a Dutch key, and all three are proper names —
but it fails the two things ADR 0001 and ADR 0002 now require. Nothing is
visible to a crawler that does not run JavaScript, and `swap()` falls back to
English silently (`:1533`, "never guess"), which is how a Dutch market loses
half a page without anyone noticing.

We decided a generator is the **sole writer of the HTML in `dist/`**: one Page
source per Page, each shared surface (head, nav, footer) declared once, and ten
addresses emitted from it. Three invariants come with that role:

- a `--check` sweep proves the committed output is current, so output cannot
  drift from source unnoticed;
- a visible string with no Dutch key **fails the build** instead of falling back.
  The dictionary keeps its job and loses its silence;
- `sitemap.xml` and every page's `rel=canonical` derive from the same route
  table, in the same generated commit, so they cannot disagree.

Rejected: ten hand-maintained HTML files (a copy change is then a ten-file
change, and the failure above is permanent); keeping one URL and trusting search
rendering (ADR 0001).

Consequences: `dist/` is generated and never edited; the repository gains a
build step where the README currently advertises none; the language control
becomes a link to the other variant rather than an in-page mutation; and the
22.3KB dictionary leaves the browser and becomes build input, which is a
side benefit worth having but not the reason for the decision.
