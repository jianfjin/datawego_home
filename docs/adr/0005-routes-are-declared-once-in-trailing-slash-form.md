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

## Amendment (2026-10-23, measured against the deployed site)

The first amendment's `.html` exception and this decision's "the table is the only
list" both turned out to be claims about files rather than about addresses. The
deploy answered both.

**An asset address has no extension either.** The exception above was granted
because the Diagram pages "already answer at `/docs/<name>.html`". Measured, they
do not answer there: Pages serves the file `docs/<name>.html` at the bare
`/docs/<name>`, and answers the `.html` form — and the trailing-slash form — with
a 308 to the bare one. So the bare address is the only spelling this rule is
allowed to name, and the links written before the plan keep working because the
platform redirects them, not because this repository carries a file extension into
an address where it is asked to be noise. The table now refuses `.html` in any
address; the extension lives in the file name, and one mapping between the two
(`assetFile` in `build.mjs`) is what stops the address and the file from each
getting their own idea.

**What a page asks for is also an address.** Two kinds of link were hand-written
and relative: the four Diagram links, and every artwork reference — the icons, the
logo, the hero, the social card. A relative path is correct beside the file it was
authored in and wrong everywhere else, and "everywhere else" included the English
homepage, which is the address the site hands Google as `x-default`: it asked for
`/en/assets/logo…` and `/en/docs/pharm-platform.html` and was answered with 404 in
both cases. The Dutch root only looked right because the root is where a relative
path happens to resolve. Two rules follow from the one above:

- a link to another address of this site is authored as `{{LINK:<route key>}}` and
  filled in from the table, so a list of addresses cannot hide inside `href` —
  the same reason the chrome is a token;
- every file a page asks for is emitted rooted (`/assets/<name>`), which a page at
  an unknown path — the not-found response, at any address at all — needs for the
  same reason a variant two directories deep does.

Both are asserted against what the build wrote, resolved from each page's own
address, so the next relative path fails the build rather than shipping a broken
image.

Rejected: `_redirects` entries for the `.html` forms (Pages already answers them,
and a rule that duplicates the platform is a second thing to keep correct); a
`<base>` element (it would rewrite the fragment links and the same-page anchors
too); leaving the extension in the address and adding `-L` to the assertions
(a contract that follows redirects to prove a link works has stopped testing the
link).
