/**
 * The machine-readable version of what the site already says out loud.
 *
 * Every value is read out of `company.mjs` and `routes.mjs` (ADR 0011), which
 * is not tidiness for its own sake: a typed second statement is a second thing
 * to get wrong, and with no Google Business Profile (ADR 0009) this block *is*
 * the set of facts Google can check the site against. So the register stays the
 * reference and this file stays a boundary — change a fact in one place and the
 * graph changes in the same commit, or the build's own tests disagree.
 *
 * Two silences are load-bearing, and both were decided before this file existed:
 *
 * - no `legalName`. An eenmanszaak's statutory name is its registered owner, and
 *   the site names nobody (ADR 0008, ADR 0011's first amendment). `name` is the
 *   trade name, which is the truth available.
 * - no `Person`, no `legalForm`, no `numberofEmployees`, no `employee`, and no
 *   `LocalBusiness` or `ProfessionalService` — the latter two belong to the map
 *   pack's instrument, which the firm declined when it declined the Profile.
 * - no `dateModified`, not even a build timestamp. A timestamp that means "this
 *   file was written today" would be a page claiming it was edited today.
 *
 * `@id`s make the nodes one description rather than several: the home Page
 * declares the Organization and the Site, and everything else that ever points
 * at them — U9's `Service`, the breadcrumbs, every `WebPage` on the site —
 * points by address instead of restating KvK numbers in a second place. The one
 * pointer that leaves its own document is `#website` on a Page that is not the
 * home one, which is where ADR 0011 puts the Site node.
 */
import { company } from "./company.mjs";
import { LANGS, breadcrumbs, urlOf } from "./routes.mjs";

/** The site's own root, as schema.org wants it: the origin with a slash on it. */
const SITE_ROOT = `${company.origin}/`;

/** The home route carries the `WebSite` node, per ADR 0011's per-page list. */
const HOME_ROUTE = "home";

export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": `${SITE_ROOT}#organization`,
    name: company.name,
    url: SITE_ROOT,
    email: company.email,
    identifier: [
      {
        "@type": "PropertyValue",
        propertyID: "KvK-nummer",
        name: "KvK-nummer",
        value: company.kvk,
      },
    ],
    address: postalAddress(),
    sameAs: [...company.sameAs],
  };
}

/**
 * One node for the whole site, identical at every address and in every language.
 *
 * `inLanguage` is the list rather than the page's own language, because this
 * node is not describing a page: the site is bilingual, and a node that changed
 * depending on which variant rendered it would be two statements about one
 * thing — which is the failure this whole module exists to prevent.
 */
export function webSiteNode() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_ROOT}#website`,
    url: SITE_ROOT,
    name: company.name,
    inLanguage: [...LANGS],
    publisher: { "@id": `${SITE_ROOT}#organization` },
  };
}

/**
 * One Practice area, described as the offer the Page above it says it is.
 *
 * ADR 0011 puts this node on the three Practice-area Pages and not on the
 * industry Page: selling data platforms is a service, selling them to a hospital
 * is a place. `provider` points at the Organization rather than repeating the KvK
 * number, which is the whole reason the `@id`s exist.
 *
 * `areaServed` is the register's ISO code and not a place name, because the
 * country is already stated once, in the Organization's address; "Nederland"
 * beside `NL` would be a second fact to keep true.
 */
export function serviceNode({ route, lang }) {
  const canonical = urlOf(route.key, lang);
  return {
    "@type": "Service",
    "@id": `${canonical}#service`,
    name: route.name[lang],
    url: canonical,
    provider: { "@id": `${SITE_ROOT}#organization` },
    areaServed: company.serviceAreaCountryCode,
  };
}

/**
 * The trail above this address, generated twice per route.
 *
 * A breadcrumb is the one part of the graph that is a list of *other* pages, so
 * it is the easiest place on the site to state an English page's name in Dutch;
 * the crumbs come from `breadcrumbs()`, in this variant's language, which is the
 * same table the navigation and the `hreflang` set read.
 *
 * The home Page gets none. It is one crumb deep, and a trail that leads nowhere
 * above the page it is standing on is the page pointing at itself.
 */
export function breadcrumbNode({ route, lang }) {
  const canonical = urlOf(route.key, lang);
  return {
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement: breadcrumbs(route.key, lang).map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.href,
    })),
  };
}

/**
 * This address, described. Its `@id` is the canonical, so the two cannot disagree.
 *
 * What the page owns is hung off it by address, never restated: the `Service`
 * beside it (Practice areas) and the trail above it (every Page but the home
 * one). Both point at a node in the same `@graph`, so a reader that resolves one
 * resolves the claim, and a reader that resolves neither finds nothing typed
 * twice to disagree with.
 */
export function webPageNode({ route, lang, title, description }) {
  const canonical = urlOf(route.key, lang);
  const node = {
    "@type": "WebPage",
    "@id": canonical,
    url: canonical,
    name: title,
    description,
    inLanguage: lang,
    isPartOf: { "@id": `${SITE_ROOT}#website` },
    about: { "@id": `${SITE_ROOT}#organization` },
  };
  if (route.practice) node.mainEntity = { "@id": `${canonical}#service` };
  if (route.key !== HOME_ROUTE) node.breadcrumb = { "@id": `${canonical}#breadcrumb` };
  return node;
}

/** What one Page says about itself, in one `<script>`. */
export function pageGraph({ route, lang, title, description }) {
  const graph = [organizationNode()];
  if (route.key === HOME_ROUTE) graph.push(webSiteNode());
  if (route.practice) graph.push(serviceNode({ route, lang }));
  if (route.key !== HOME_ROUTE) graph.push(breadcrumbNode({ route, lang }));
  graph.push(webPageNode({ route, lang, title, description }));
  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * The company's address, at the precision ADR 0009 lets it be stated.
 *
 * The street and the postcode are read from the register rather than hardcoded
 * away, so `company.mjs` stays the single answer — but they are `null` there on
 * purpose, and `tests/seo-graph.test.mjs` holds `address` to exactly these two
 * keys. Filling the street in is allowed; it just has to be a decision that
 * went past that test and the amendment it cites.
 */
function postalAddress() {
  const address = { "@type": "PostalAddress" };
  if (company.streetAddress) address.streetAddress = company.streetAddress;
  if (company.postalCode) address.postalCode = company.postalCode;
  address.addressLocality = company.locality;
  address.addressCountry = company.countryCode;
  return address;
}

/**
 * Key order comes from the literals above, not from a sort, so the bytes in
 * `dist/` mean something: `--check` compares what the last build promised to
 * have written, and a graph that reordered on each run would make that a lie.
 */
export function serializeGraph(value) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/** The `<script>` for one Page, pre-indented for the head it is joined into. */
export function graphScript(value) {
  return `<script type="application/ld+json">\n  ${serializeGraph(value).replace(/\n/g, "\n  ")}\n  </script>`;
}
