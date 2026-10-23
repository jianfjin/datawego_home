# Every address is declared once, in the form Pages actually answers

Ten addresses (ADR 0001, ADR 0002) can be spelled two ways on Cloudflare Pages:
`/dataplatforms` and `/dataplatforms/`. They are not equal. A directory asset is
answered at the trailing-slash form, and the bare form is a 308 redirect to it —
verified on the sibling site this repo already copies deploy patterns from, where
`/organization` 308s to `/organization/` even though that site's `canonical` and
`sitemap.xml` both name the bare form. Its sitemap therefore costs every crawler
a redirect per URL, and every page's canonical points at an address that does not
answer. That is the defect this decision avoids.

We decided the route table is the site's only list of addresses, written in the
**trailing-slash directory form**, and that the generator draws the sitemap, every
page's `rel=canonical`, the `hreflang` alternates and the navigation links from
that one table — so the four cannot disagree, which is the failure `edm_home`
tests for and still gets wrong in form.

Dutch slugs come from the Dutch words the site already uses for these surfaces
(`Dataplatforms`, `AI-oplossingen`, `Cloud- & enterprise-software`,
`Zorg & life sciences`), not from a fresh translation of the English names, so a
URL cannot drift from the heading it points under. `&` becomes `en`/`and`: an
unencoded `&` in a path reads as a query separator.

Rejected: a `/diensten/` grouping segment (three peers, no intent in the extra
segment); `.html` addresses (a file extension in a company URL is noise the
redirect would only exist to remove).

Consequence, stated plainly: a slug outlives its copy. Changing one later is a
301 plus a rebuilt `hreflang` table, not a rename.

## Amendment (2026-10-23, while writing the table)

Two things the decision had to admit once `src/site/routes.mjs` existed:

**The `.html` rejection has one exception, and it is not a Page.** The four
Diagram pages already answer at `/docs/<name>.html`, and the homepage already
links there. Renaming them to `/docs/<name>/` to honour the rule above would
break live links to gain nothing: they are `noindex, follow` (ADR 0002), so no
canonical, no sitemap row and no `hreflang` set depends on their form. They are
therefore declared `form: "asset"`, which the validator allows only for a route
that is not a Page — an extension is still not permitted in a company URL that
asks to be ranked.

**The breadcrumb root is named by the brand, not by the word "Home".** A
`BreadcrumbList` needs a first crumb with a name, and the obvious label is one
this site never writes: the nav has no Home item, the dictionary has no such
key, and `datawego-company-site.html` contains the string "Home" zero times.
Inventing a fifth language key to label the root would be a word the site says
only to Google. The root crumb is `DataWeGo` in both variants, which is also
what the brand query is actually matching.
