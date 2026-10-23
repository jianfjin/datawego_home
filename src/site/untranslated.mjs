/**
 * Every visible string the Dutch variant leaves as the source wrote it.
 *
 * ADR 0003 gives the build the right to fail on a missing Dutch key, which is
 * only fair if the strings that legitimately have no key are named somewhere.
 * They are here, one entry per exact source string, in three kinds. The build
 * fails in both directions:
 *
 * - a visible string with no dictionary key and no entry here is untranslated
 *   Dutch-market copy, which is the failure ADR 0003 exists to catch;
 * - an entry here that no longer matches anything visible is a claim about the
 *   page that stopped being true, and the ledger would otherwise rot the way
 *   the dictionary's thirteen unused keys already did.
 *
 * `same in dutch` is not a shrug: those words are what a Dutch data person
 * writes, and the site's own dictionary already keeps `analytics` and
 * `life sciences` for the same reason. Renaming one is a copy decision for the
 * owner, not a build decision.
 */
export const LEDGER = Object.freeze({
  // ── names: a brand, a product, or a title of a thing ──────────────────────
  DataWeGo: { kind: "name", why: "the company; also the wordmark's alt text" },
  Data: { kind: "name", why: "the first half of the split wordmark in the footer" },
  WeGo: { kind: "name", why: "the second half of the same wordmark" },
  LinkedIn: { kind: "name", why: "the profile's own name" },
  "Pharm Platform": { kind: "name", why: "case-study title, as the client's documents name it" },
  "EHR ETL Pipeline": { kind: "name", why: "case-study title" },
  "Marketing Research Swarm": { kind: "name", why: "case-study title" },
  "EHR Transform Platform": { kind: "name", why: "case-study title" },
  Python: { kind: "name", why: "a language" },
  Dagster: { kind: "name", why: "an orchestrator" },
  DuckLake: { kind: "name", why: "a table format" },
  LangGraph: { kind: "name", why: "a framework" },
  "FHIR R4": { kind: "name", why: "a standard, with its version" },
  "HL7 FHIR": { kind: "name", why: "the same standard, named once more" },
  "OMOP CDM": { kind: "name", why: "a schema" },
  OMOP: { kind: "name", why: "the same schema, shortened" },
  EHDS: { kind: "name", why: "the European data-space regulation" },
  RAG: { kind: "name", why: "an abbreviation, and the one a Dutch engineer uses" },

  // ── the same in Dutch: an English word that is also the Dutch word ────────
  Platform: { kind: "same in dutch", why: "platform" },
  PLATFORM: { kind: "same in dutch", why: "the section eyebrow; `PLATFORM` is the Dutch word, capitalised" },
  Online: { kind: "same in dutch", why: "online" },
  Model: { kind: "same in dutch", why: "model — the `dt` one; the stage `Model` has its own qualified key" },
  Menu: { kind: "same in dutch", why: "menu" },
  Contact: { kind: "same in dutch", why: "contact" },
  Expertise: { kind: "same in dutch", why: "expertise" },
  Dashboards: { kind: "same in dutch", why: "dashboards" },
  Observability: { kind: "same in dutch", why: "observability, in the Dutch sense of the loanword" },
  Lakehouse: { kind: "same in dutch", why: "the architecture is called that in Dutch" },
  "Feature store": { kind: "same in dutch", why: "the component is called that in Dutch" },
  "Embedded analytics": { kind: "same in dutch", why: "matches the dictionary's own `data-infrastructuur & analytics`" },
  "Open data": { kind: "same in dutch", why: "open data, also in Dutch policy language" },
  "ERP & CRM": { kind: "same in dutch", why: "two abbreviations and a Dutch `en` spelled as `&` on the chip" },
  "CDC & change capture": { kind: "same in dutch", why: "an abbreviation plus a term of art" },
  "CONTROL PLANE": { kind: "same in dutch", why: "OPEN copy question: `beheerlaag` is the Dutch candidate, and this ledger entry is where that change starts" },

  // ── not copy: an address, a host, or a language control ───────────────────
  EN: { kind: "not copy", why: "the language control names the languages, in both variants" },
  NL: { kind: "not copy", why: "as above" },
  "www.datawego.nl": { kind: "not copy", why: "a host name" },
  "info@datawego.nl": { kind: "not copy", why: "an email address, and the KvK number's partner in ADR 0009" },
  "KVK-nummer: 42077839": { kind: "not copy", why: "already Dutch, and a registry number" },
});

export const LEDGER_KINDS = Object.freeze(["name", "same in dutch", "not copy"]);

export function isLedgered(text) {
  return Object.prototype.hasOwnProperty.call(LEDGER, text);
}
