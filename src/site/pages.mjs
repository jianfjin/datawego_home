/**
 * The Pages that are not the prototype.
 *
 * `datawego-company-site.html` is a whole document: it is what a person opens to
 * see the site, and it carries the chrome that every other Page needs (CONTEXT.md
 * calls it Chrome, and refuses "template"). The four surfaces ADR 0002 adds are
 * authored as bodies instead — sections, no head, no nav, no footer — and the
 * build composes them onto that chrome. That is the only way "route-table-driven
 * navigation on all ten addresses" can be one edit rather than five, and the
 * reason a second copy of the prototype is not in this repository.
 *
 * Two tables live here, and neither holds a sentence the site has not said:
 *
 * - `PAGE_BODIES` says which file carries a Page's sections;
 * - `PAGE_SUMMARIES` names the sentence each Page's `<meta description>` and its
 *   opening paragraph are. The value is the *English* sentence as it is written in
 *   the home Page source, and the Dutch is the dictionary's answer for that exact
 *   string — so this file states no fact twice, and `seo-build.test.mjs` refuses a
 *   summary that stopped being a dictionary key.
 *
 * A title is never written here. `DataWeGo — Zorg & life sciences` is the brand
 * and the route table's own name for the address, and a title typed into this file
 * would be a third place the page's name lives.
 */
import { company } from "./company.mjs";

/** The token a body writes where its own name belongs. */
const NAME_TOKEN = "{{PAGE_NAME}}";

export const PAGE_BODIES = Object.freeze({
  dataplatforms: "src/pages/dataplatforms.html",
  "ai-oplossingen": "src/pages/ai-oplossingen.html",
  "cloud-en-enterprise-software": "src/pages/cloud-en-enterprise-software.html",
  "zorg-en-life-sciences": "src/pages/zorg-en-life-sciences.html",
});

export const PAGE_SUMMARIES = Object.freeze({
  dataplatforms: "Modern lakehouse and warehouse architectures that unify clinical, operational and product data — modelled for analysts and for machines, not just dashboards.",
  "ai-oplossingen": "Prediction, classification and generative assistants built on governed data — with evaluation, monitoring and human review designed in from day one.",
  "cloud-en-enterprise-software": "Cloud-native architectures, APIs and integration layers that connect platforms to the systems your organisation already depends on.",
  "zorg-en-life-sciences": "Interoperability work that has to survive a privacy review: patient records harmonised across systems, study data prepared for analysis, and models that stay explainable to clinicians.",
});

/** What a body writes, and what the build replaces, for the page's own name. */
export function pageNameToken() {
  return NAME_TOKEN;
}

export function isBodyPage(key) {
  return Object.prototype.hasOwnProperty.call(PAGE_BODIES, key);
}

/**
 * The `<title>` and description this address owes, in this language.
 *
 * The body page's name is the route table's, because the table owns addresses and
 * the names that go in them (ADR 0005); the description is the summary, in Dutch
 * only as the dictionary has it.
 */
export function pageHead({ route, lang, lookup }) {
  const title = `${company.name} — ${route.name[lang]}`;
  const english = PAGE_SUMMARIES[route.key];
  const description = lang === "nl" ? (lookup(null, english) ?? english) : english;
  return { title, description };
}
