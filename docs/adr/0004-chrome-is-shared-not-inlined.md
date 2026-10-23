# Page chrome is shared by address, not inlined into every page

The prototype is one self-contained file because it is one screen: 30.7KB of CSS
and 45.2KB of JS (23.3KB of it the Dutch dictionary) ride along with 32.6KB of
copy. Generating ten addresses out of that shape (ADR 0003) ships the 54KB of
unchanging chrome once per document, and inlined CSS and JS are part of the
document, not cacheable subresources — so a visitor who reads three pages pays
for the same chrome three times, and the cost lands on the Largest Contentful
Paint that ranking already measures.

We decided the generated pages link shared `site.css` and `site.js` and carry
only their own copy. `docs/DESIGN-HANDOFF.md:46` argues for the same split from
the other direction: a single self-contained file is acceptable *only when* the
export truly contains one user-facing screen, which stopped being true at ADR
0002.

Rejected: keeping every generated page self-contained. It preserves "copy one
file and open it", which for a five-page company site was never the point of the
prototype, and it buys that with a per-navigation 54KB on every page but the
home one.

Consequences: the repository gains a build step and `dist/assets`, so
`README.md:10` ("No build step") and the quick start are now wrong and get
rewritten; the Dutch dictionary moves out of the browser into build input, which
leaves `site.js` holding behavior only; and a page opened from disk stops
rendering styled, because its chrome now lives beside it rather than inside it.
