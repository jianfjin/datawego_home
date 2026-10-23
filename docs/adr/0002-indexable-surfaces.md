# Five indexable surfaces, Dutch-first, with the Diagram pages kept out of the index

The site was one Page, and a Page can hold only one title and one intent. The
Dutch queries with buying intent belong to a kind of work, not to the company in
general, so the five surfaces search is asked to rank are: the home Page, one
Page per Practice area (Data platforms, AI-powered solutions, Cloud & enterprise
software — the same three the site already claims in `#capabilities`), and one
industry Page for zorg & life sciences. Each exists in a Dutch and an English
variant: ten addresses.

Case studies do not become Pages. They stay evidence inside the home Page and
the Practice-area Pages they belong to; four of them, promoted to their own
URLs, would compete with the Practice area they are supposed to prove.

Diagram pages do not become indexable surfaces either. Each is roughly 800KB of
self-contained drawing whose text is thin and whose purpose is to be opened by
someone who already read the Case study, so they are served `noindex, follow`.
They stay linked, because link equity and a visitor's need to see the drawing do
not require the drawing to be findable on its own.

The directive is a `robots` meta rather than a header, and it sits in a head this
repository writes at build time, not in the exported file (U6): regenerating a
drawing must not be able to re-open a page to the index by accident. Nothing
claims those four addresses anywhere else — no sitemap row, no `hreflang`, and
deliberately no `rel=canonical`, because a canonical answers "which address is
this page" about a page that has already answered "don't index this one", and
Google asks that the two not be combined.
