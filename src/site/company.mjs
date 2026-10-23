/**
 * The company's own facts, stated once.
 *
 * Nothing else in this repository may restate them: every JSON-LD node, footer
 * line and sitemap host is generated from here (ADR 0011). A hand-copied second
 * statement is how a site ends up saying two different things about itself, and
 * with no Google Business Profile (ADR 0009) these values are also the only
 * facts Google can cross-check the site against — so the register is the
 * reference, not the prose.
 *
 * What is deliberately NOT here is as load-bearing as what is:
 *
 * - `legalName` — an eenmanszaak's statutory name is its registered owner,
 *   and the site names nobody (ADR 0008, ADR 0011 amendment). `name` is the
 *   trade name, which is the truth being told.
 * - the legal form as a rendered claim — `legalForm` exists for the generator
 *   to reason about and `renderLegalForm` keeps it out of the graph, so no
 *   `legalForm`/`numberofEmployees`/`employee` field implies limited liability
 *   or a headcount.
 * - `foundingDate` — stated only when it is verifiable, which it is not today.
 *   An absent field is honest; an invented one is a YMYL problem.
 * - any `Person` — `authors` is empty because that is the decision, not an
 *   oversight.
 * - a street address — city level, per ADR 0009 and the `Organization` choice
 *   in ADR 0011. The footer used to publish a street address, which contradicted
 *   this; decision ADR 0011's second amendment takes it out (U3).
 */
export const company = Object.freeze({
  name: "DataWeGo",
  legalName: null,
  legalForm: "eenmanszaak",
  renderLegalForm: false,

  kvk: "42077839",
  email: "info@datawego.nl",
  phone: null,

  locality: "Den Haag",
  countryCode: "NL",

  /**
   * Decided 2026-10-23, in favour of the city: the footer's street line
   * (`Spieringdam 1 / 2492 ND Den Haag`, and very likely a home address — the
   * BAG lists the parcel with a `woonfunctie`) leaves the site with U3, along
   * with the two ledger entries that excuse it. The register does not gain it.
   *
   * This was the contradiction ADR 0009 calls fatal — the graph at city level,
   * the page at street level, and nothing else standing between the two and
   * Google's cross-check. ADR 0011's second amendment records the choice.
   */
  streetAddress: null,
  postalCode: null,

  /** The one host that answers (ADR 0006). Every emitted URL is absolute from here. */
  origin: "https://www.datawego.nl",

  linkedin: "https://www.linkedin.com/company/datawego",
  sameAs: Object.freeze(["https://www.linkedin.com/company/datawego"]),

  /** Service area, for `Service.areaServed` — a country, not a radius. */
  serviceAreaCountryCode: "NL",

  authors: Object.freeze([]),

  /**
   * The sole-practice clause, kept here because it is a claim about the company
   * rather than page copy (ADR 0012). The generator places it on every indexable
   * Page in both Language variants; a route that cannot show it has a bug.
   */
  practiceClause: Object.freeze({
    nl: "DataWeGo is een onafhankelijke data- en AI-adviseur: wie de scope bepaalt, bouwt het ook.",
    en: "DataWeGo is an independent data and AI adviser: whoever scopes the work builds it.",
  }),
});
