# DataWeGo Company Website

The public site for a Dutch data engineering & AI consultancy, deployed to
Cloudflare Pages at www.datawego.nl (ADR 0006). It is authored as one Page
source in English with its Dutch dictionary inside it, and `build.mjs` generates
the Dutch and English variants into `dist/`, so what is served answers in its own
language without running anything (ADR 0001, ADR 0003).

## Language

### Purpose

**Enquiry**:
A composed Contact brief that the visitor asked the site to hand to the company mailbox. Preparing a brief without asking for it to be sent is not yet an Enquiry.
_Avoid_: submission, message, lead

**Organic enquiry**:
An Enquiry whose first touch was an unpaid search result. The unit SEO is measured in — neither traffic nor rank.
_Avoid_: organic traffic (counts visits, and a visit that sends nothing is not the point)

### Surfaces

**Practice area**:
One of the three kinds of work the site claims: Data platforms, AI-powered solutions, Cloud & enterprise software.
_Avoid_: capability (the bullets inside an area), service line

**Case study**:
One of four named pieces of shipped work that evidence a Practice area: Pharm Platform, the EHR ETL pipeline, the Marketing Research Swarm, and the EHR Transform Platform.
_Avoid_: reference, project

**Diagram page**:
The self-contained architecture drawing a Case study opens, under `docs/`. It is
evidence about a piece of work, not a claim about the company, so it is served
and linked and asked out of the index. The drawing belongs to whoever exported
it; the `<head>` belongs to this repository, which is why its title and its
description are in `src/site/diagrams.mjs` and not in the file a re-export
overwrites.
_Avoid_: doc (the folder also holds plans and design notes that are not Diagram pages), evidence page (the evidence is the drawing; the page carries it)

**Page**:
A surface with an address of its own, so search can be pointed at it separately from anything else on the site.
_Avoid_: Section (a Section is inside a Page and has no address), view, screen

**Indexable surface**:
One of the five Pages the site asks search to rank, each in two Language variants: home (`/`), the three Practice-area Pages (`/dataplatforms/`, `/ai-oplossingen/`, `/cloud-en-enterprise-software/`) and the Zorg & life sciences Page (`/zorg-en-life-sciences/`). A Diagram page is never an Indexable surface.
_Avoid_: landing page (marketing-speak for the same thing here), public page (Diagram pages are public but not indexable)

**Section**:
An anchored band of the one-pager — `#about`, `#capabilities`, `#industries`, and their like. A Section is not a page; it has no address of its own.
_Avoid_: landing page, anchor page

**Language variant**:
One of the two renderings of the same Page — Dutch and English. A Page has exactly two, each with its own address, and they make the same claims.
_Avoid_: translation (the words differ; a variant that says something the other does not is a different Page, not a variant)

**Page source**:
The one authored file a Page is generated from — its English markup and that Page's Dutch entries. A site of five Pages has five Page sources and ten generated files.
_Avoid_: template, master file (the source is not a shell waiting for data; it is the Page, written once)

**Not-found page**:
What an unknown address is answered with: one Dutch page, `noindex, follow`, with
a way out and no address of its own. It is a response rather than a Page, which is
why it carries no canonical and no `hreflang` set.
_Avoid_: 404 (the status it accompanies, not the page), soft 404 (a page that
exists pretending to be this one, which is the failure it exists to prevent)

**Artwork reference**:
A path a page asks the host for, in an attribute — as opposed to a file the page
merely mentions in a comment. The first is put on the network; the second stays
in the source, where it can keep saying where an image came from. A reference the
repository cannot satisfy is a failed build, not a broken image.
_Avoid_: asset (here it would mean both the file and its shipped name, and U5
separated the two), dependency

**Derived file**:
Shipped artwork that came from an authored file by a command a person runs —
`tools/derive-images.py` cuts the hero widths, rasterises the PNG icons out of
`favicon.svg`, and composes the social card. It is committed rather than built,
so the build needs no image toolchain and `--check` can compare against the exact
bytes a deploy uploads.
_Avoid_: generated (the Pages are generated, every build, from a source that is
not itself shipped; a derived file is made once and then reviewed)

**Fetching and keeping**:
The two separate questions a site answers a crawler: whether it may read a path
(`robots.txt`), and whether what it read may be indexed (a `noindex` in the page).
Neither substitutes for the other, and `docs/` is deliberately fetchable and
deliberately not indexed.
_Avoid_: blocking (which of the two it blocks is the whole question), hiding

**Chrome**:
What every Page has in common — navigation, footer, styling, behavior. Chrome is reached by a shared address rather than repeated per Page, so one visit pays for it once.
_Avoid_: shell, layout, template, self-contained file (that is how the prototype shipped, not a part of a Page)

**Practice-area page**:
An Indexable surface that makes the case for one Practice area — the work, how it goes, what it costs to get wrong, and the Case studies that prove it. Three exist, one per Practice area.
_Avoid_: service page (the site does not sell a service by the hour; it names a kind of work), capability page

**Industry page**:
An Indexable surface organised by the buyer's world rather than by the work — zorg & life sciences. It points at Practice-area pages instead of replacing them.
_Avoid_: vertical page, sector page (the nav calls the list Sectoren, which is a Section, not a Page)

**Attribution**:
What an Enquiry says about where its visitor came from — the referring site's origin, the address they landed on, and the Language variant they read. It travels inside the enquiry itself; no third party is shown it.
_Avoid_: analytics, tracking (those imply a service watching visits; this is a note the enquiry carries)

**Sole practice**:
The firm's registered form — one adviser trading as DataWeGo as an eenmanszaak, so whoever scopes the work builds it. A statement of method, not of headcount.
_Avoid_: team (every use of that word on the site is about the *client's* people), boutique, agency, consultancy firm (fine in prose, but it invites a staff count the site never claims)
