/**
 * The head of a Diagram page, declared here rather than in `docs/*.html`.
 *
 * Those four files are archify's output. Re-exporting a drawing rewrites the
 * whole document, `<title>` and all, so a `robots` meta typed into the source
 * is gone the next time someone regenerates — and what replaces it is the
 * exporter's own guess at a title. Two of the four that ship today are exactly
 * that guess, and one of them still carries a Python module name
 * (`marketing_research_swarm`) where a reader expects words. So the split is by
 * ownership, not by convenience: the drawing is the body and is never touched
 * (R8), the head is the site's and is put on at build time.
 *
 * One entry per live Diagram route, in English on both counts — a Diagram page
 * has no second variant (ADR 0002), and its labels are the ones the drawing was
 * authored with. A Dutch visitor who follows a link here reads an English
 * diagram, so an English description is the honest one.
 *
 * What is deliberately *not* here, and why:
 *
 * - No `rel=canonical`. Google asks that the two not be combined: a canonical
 *   says "index this address instead", `noindex` says "index neither". A page
 *   that is not in the index has one address, and it is the one in the table.
 * - No `hreflang`, no `og:`/`twitter:` card. Every one of those tags exists to
 *   tell a crawler or a sharer about an address it might rank. This one it is
 *   asked not to, and evidence pages are followed, not shared.
 * - No `noindex` either. That comes from `indexable: false` in the route table,
 *   so it cannot be forgotten on one page while it is remembered on three.
 */
import { SITE_ICONS, attr } from "./page.mjs";
import { encodeText } from "./markup.mjs";

export const DIAGRAM_HEAD = Object.freeze({
  "diagram-pharm-platform": Object.freeze({
    title: "Pharm Platform — architecture diagram",
    description:
      "How the Pharm Platform answers a biomedical query: a FastAPI bridge, BioChemRAG fan-out, tiered ChromaDB and DuckDB retrieval, and open-data refresh.",
  }),
  "diagram-ehr-etl-pipeline": Object.freeze({
    title: "EHR ETL Pipeline — data flow diagram",
    description:
      "Five stages a non-compliant EHR export passes through: ingest and PHI strip, rule-based code map, a triage and auto-write gate, then FHIR, OMOP and HealthDCAT.",
  }),
  "diagram-marketing-research-swarm": Object.freeze({
    title: "Marketing Research Swarm — architecture diagram",
    description:
      "A LangGraph research swarm: selected agents share a blackboard, call analytics and sales-data tools, and answer through corrective RAG over a knowledge base.",
  }),
  "diagram-ehr-transform-platform": Object.freeze({
    title: "EHR Transform Platform — architecture diagram",
    description:
      "The platform behind the transform: Dagster assets over MinIO and DuckLake, publishing FHIR R4, OMOP CDM and HealthDCAT, with an EHDS compliance auditor.",
  }),
});

/**
 * Give an archify document the head this repository says it should have.
 *
 * `source` comes back with its title replaced and four lines inserted after it;
 * everything from the `</title>` onward inside the document, and the whole of
 * the body, is the bytes that went in. Anything unexpected about the source is
 * a problem rather than a silent skip: a drawing that no longer opens its head
 * with a title, or one that already answers `robots`, means this function and
 * the exporter have started to disagree about the same file.
 */
export function applyDiagramHead(source, route) {
  const problems = [];
  const head = DIAGRAM_HEAD[route.key];
  if (!head) {
    return {
      html: source,
      problems: [`${route.key}: diagrams.mjs declares no head for it, so it would ship the exporter's title (R8)`],
    };
  }

  const open = source.indexOf("<head>");
  const close = source.indexOf("</head>", open + 1);
  if (open < 0 || close < 0) {
    return { html: source, problems: [`${route.key}: no <head> to write into — the exporter changed the shape of docs/${route.key}`] };
  }
  const headSlice = source.slice(open, close);

  const title = /<title>[\s\S]*?<\/title>/.exec(headSlice);
  if (!title) {
    return { html: source, problems: [`${route.key}: its head holds no <title> to replace; the generator expects the exporter's first line inside <head> to be one`] };
  }
  for (const [what, re] of [
    ["robots", /<meta[^>]+name=["']robots["']/i],
    ["description", /<meta[^>]+name=["']description["']/i],
    ["canonical", /<link[^>]+rel=["']canonical["']/i],
  ]) {
    if (re.test(headSlice)) {
      problems.push(`${route.key}: its head already carries a ${what} meta — two answers to one question is a contradiction the crawler resolves on its own, not here`);
    }
  }
  if (problems.length) return { html: source, problems };

  const lines = [
    `<title>${encodeText(head.title)}</title>`,
    `<meta name="description" content="${attr(head.description)}" />`,
    `<meta name="robots" content="${route.indexable ? "index" : "noindex"}, follow" />`,
  ];
  for (const icon of SITE_ICONS) {
    const attrs = [`rel="${icon.rel}"`, `href="${icon.href}"`];
    if (icon.type) attrs.push(`type="${icon.type}"`);
    if (icon.sizes) attrs.push(`sizes="${icon.sizes}"`);
    lines.push(`<link ${attrs.join(" ")} />`);
  }

  const at = open + title.index;
  const html = source.slice(0, at) + lines.join("\n  ") + source.slice(at + title[0].length);

  return { html, problems };
}
