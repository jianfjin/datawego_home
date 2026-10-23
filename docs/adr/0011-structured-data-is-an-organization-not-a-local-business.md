# Structured data describes an Organization, generated from one facts module

The site states nothing machine-readable about itself today: no
`application/ld+json` anywhere. The recommendation to describe the firm as
`ProfessionalService` was rejected for a reason that only holds because of ADR
0009: that type belongs to the `LocalBusiness` family, whose expectations are the
map pack's — a full street address and `geo`. A firm that has declined a Google
Business Profile has no business being measured by the instrument it opted out of.
`Organization` carries the registrable facts without that invitation.

One module holds the facts — KvK 42077839, `info@datawego.nl`, Den Haag, the
company LinkedIn, `https://www.datawego.nl` — and every page's JSON-LD derives from
it, the way the sibling project derives its register facts and refuses to type them
into a page. Deriving is not tidiness: a hand-copied block is a second statement of
the same facts, and the two drift, and then the site says two different things about
the company that owns it.

Per page: `Organization` everywhere; `WebSite` on the home Pages; `WebPage` with
`@id` equal to that variant's own canonical and `inLanguage` matching it; `Service`
on the three Practice-area pages, whose `provider` points at the Organization by
`@id` instead of restating it; `BreadcrumbList` on the four sub Pages, generated
twice per route so an English page never shows Dutch names.

Three exclusions, each a consequence of an earlier decision rather than a taste:

- no `Person` nodes — no `author`, `founder`, `employee`, no `sameAs` to anyone's
  profile. ADR 0008.
- no `FAQPage`, no `HowTo`. Google retired those rich results in August 2023;
  writing them bilingually spends the copy budget on a feature that no longer
  renders.
- no `llms.txt`. It is an unofficial convention no mainstream engine or assistant is
  known to consume; ADR 0007 states the AI stance and `sitemap.xml` lists the ten
  addresses, which is the whole mechanism. Adding a made-up file is cargo cult.

`dateModified` is omitted rather than filled with a build timestamp. The pages will
carry real edit dates only when the generator can say honestly when the copy last
changed.

## Amendment on the same day: what an eenmanszaak may not say

The owner is a **eenmanszaak** trading as DataWeGo — not a B.V. Two fields follow.
`legalName` is **not emitted**: for a sole proprietorship the statutory name is the
registered owner's own name, which is exactly what ADR 0008 declines to publish, and
`name: "DataWeGo"` states the trade name truthfully on its own. Nothing in the graph
is to suggest a corporation — no `legalForm` implying limited liability, no
`numberofEmployees`, no `employee`. KvK stays, as the one fact a buyer can verify.

## Amendment on the same day: the footer loses the street line

The live footer published `Spieringdam 1 / 2492 ND Den Haag` while this ADR's
register states the firm at city level. That is ADR 0009's failure mode in the
concrete: with no Profile, the structured data and the page are one claim stated
twice, and two precisions is not a rounded pair but a contradiction about where
the firm is.

The owner decided in favour of the city, and against the street. The address is
very likely a home address — the Kadaster's BAG lists the parcel with a
`woonfunctie` as well as a `kantoorfunctie` — and a home address indexed by every
scraper that reads JSON-LD is not withdrawable. `streetAddress` and `postalCode`
stay `null`, and the footer's three address lines go with them (U3), together with
the two `not copy` entries in `src/site/untranslated.mjs` and the dictionary key
that translates the third of them. The KvK number, the email and Den Haag remain,
and are what Google has to check the site against.
