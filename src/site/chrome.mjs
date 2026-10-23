/**
 * The chrome, as the build sees it: one document, edited into another.
 *
 * CONTEXT.md's definition is the spec — what every Page has in common is
 * navigation, footer, styling and behaviour, and it is *reached* rather than
 * repeated. ADR 0004 already does that for the CSS and the script, by name. This
 * does it for the HTML around the two, because a Page body that carried its own
 * header would be a fifth place the navigation lives, and Stage 2's requirement
 * is that the navigation come from the route table.
 *
 * So the home Page source keeps its double job. It is the prototype a person
 * opens, and it is the chrome: its `<head>`, `<header>`, contact section,
 * `<footer>` and script are lifted verbatim into every other Page, and its
 * sections are what a body replaces. Nothing here re-authores them, which is why
 * every deletion is anchored to a string that must appear exactly once and a
 * source that moves those strings is a failed build rather than a silent edit.
 *
 * The one thing that is generated rather than lifted is the navigation, and it is
 * generated from the table twice over: the address from `urlOf`, the words from
 * the route's own `name`.
 */
import { ROUTES } from "./routes.mjs";
import { encodeText } from "./markup.mjs";

/** Where the home Page's own sections stop and the ask begins. */
const BODY_START = '<main id="content">';
const BODY_END = "  <!-- ── 9 · CONTACT";
const NAV_START = '<nav id="primary-nav" aria-label="Primary">';
const NAV_END = "    </nav>";
/**
 * The slot the clause is written into, authored empty in the contact section.
 *
 * It is empty on purpose and addressed by its `data-od-id`, because everything
 * else on that line is copy: a placement keyed to the sentence beside it would
 * stop matching in Dutch, where the sentence has been translated and the
 * placement has not.
 */
const CLAUSE_SLOT = /<p class="body-muted" data-od-id="practice-clause"><\/p>/;

/**
 * The header's links, from the table.
 *
 * Four links, one per Practice-area or industry Page, in table order, and the
 * home address is not among them: the logo already is that link, in the same
 * header, and a nav that lists the page you are standing on twice is how a
 * one-page site reads after it grows. The current address is marked rather than
 * removed, because a nav that reorders itself per page is a different nav on
 * every page, which is the property ADR 0004 exists to keep.
 *
 * A body carries no address of its own; the `{{LINK:…}}` token is what the page
 * being written fills, in its own language.
 */
export function navigation() {
  const pages = ROUTES.filter(
    (route) => route.kind === "page" && route.indexable && route.status === "live" && route.key !== "home",
  );
  return [
    "    <nav id=\"primary-nav\" aria-label=\"Primary\">",
    ...pages.map(
      (route) =>
        `      <a href="{{LINK:${route.key}}}" data-nav="${route.key}">${encodeText(route.name.en)}</a>`,
    ),
    '      <a class="nav-contact" href="#contact">Talk to an engineer</a>',
    "    </nav>",
  ].join("\n");
}

/**
 * The document a Page body is rendered from.
 *
 * `problems` fills in place; a non-empty array fails the build (R15).
 */
export function composePage({ chromeSource, bodyHtml, lang, problems }) {
  const html = spanOut(chromeSource, BODY_START, BODY_END, problems, "the Page sections", bodyHtml.trim() + "\n\n");
  return applyChrome(html, lang, problems);
}

/**
 * The chrome's own two edits, on a document that already has its sections.
 *
 * The home Page needs them too. Its navigation is the same four links, because it
 * is the same chrome, and the anchors here all resolve — every `id` the prototype
 * links to is in the document it is standing in.
 */
export function applyChrome(html, lang, problems) {
  const navStart = html.indexOf(NAV_START);
  if (navStart === -1) {
    problems.push(`chrome: ${JSON.stringify(NAV_START)} is no longer in the home Page source, so the navigation cannot be replaced with the route table's`);
    return html;
  }
  if (html.indexOf(NAV_START, navStart + 1) !== -1) {
    problems.push(`chrome: ${JSON.stringify(NAV_START)} appears twice, so there are two navigations to replace`);
    return html;
  }
  const navEnd = html.indexOf(NAV_END, navStart);
  if (navEnd === -1) {
    problems.push("chrome: the navigation opened in the home Page source is never closed");
    return html;
  }
  return rootForeignAnchors(html.slice(0, navStart) + navigation() + html.slice(navEnd + NAV_END.length), lang);
}

/**
 * An anchor to a section this document does not have is an address on the one that does.
 *
 * `#industries` meant the sixth section of the only page there was. With five, it
 * means the sixth section of *that* page, and a visitor reading `/dataplatforms/`
 * who is sent to `/dataplatforms/#industries` lands on nothing: the browser
 * scrolls to an absent id and reports no error, which is R19's failure shape
 * rather than R8's. So every in-page link whose target is missing here is written
 * as the home address plus its fragment, and one whose target is present stays
 * local, because a page that has its own `#contact` should not leave itself.
 */
function rootForeignAnchors(html, lang) {
  const here = new Set([...html.matchAll(/\bid="([a-z0-9-]+)"/g)].map((m) => m[1]));
  const out = html.replace(/href="#([a-z0-9-]+)"/g, (whole, id) => {
    if (here.has(id)) return whole;
    return `href="{{LINK:home}}#${id}"`;
  });
  return out;
}

/** The sole-practice clause, once, on every Page that is asked to rank (R12). */
export function practiceClause(html, clause, problems) {
  const hits = [...html.matchAll(new RegExp(CLAUSE_SLOT.source, "g"))];
  if (hits.length !== 1) {
    problems.push(`chrome: the sole-practice slot appears ${hits.length} times, and every indexable Page owes the clause exactly once (R12)`);
    return html;
  }
  const at = hits[0];
  return html.slice(0, at.index) + `<p class="body-muted" data-od-id="practice-clause">${clause}</p>` + html.slice(at.index + at[0].length);
}

/**
 * Replace one named span of the home Page source with this Page's own sections.
 *
 * Anchored at both ends and refused in the middle, because the span's two edges
 * are the only thing that says which sections are the page's and which are the
 * ask every page shares. Move either marker in the prototype and the build says
 * so, rather than quietly shipping a page whose contact form was eaten.
 */
function spanOut(html, open, close, problems, label, replacement) {
  const start = html.indexOf(open);
  if (start === -1) {
    problems.push(`chrome: ${JSON.stringify(open)} is no longer in the home Page source, so ${label} cannot be replaced`);
    return html;
  }
  if (html.indexOf(open, start + 1) !== -1) {
    problems.push(`chrome: ${JSON.stringify(open)} appears more than once, so ${label} is not one span`);
    return html;
  }
  const stop = html.indexOf(close, start);
  if (stop === -1) {
    problems.push(`chrome: ${label} has no end — ${JSON.stringify(close)} is gone from the home Page source`);
    return html;
  }
  return html.slice(0, start + open.length) + "\n" + replacement + html.slice(stop);
}
