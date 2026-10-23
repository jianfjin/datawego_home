/**
 * One Page source in, one address out.
 *
 * The source is what the prototype always was: English markup, with the Dutch
 * dictionary riding along in a script at the bottom. This module turns the key
 * twice — once on the visible strings, once on the strings that live in script —
 * and then removes the machinery that used to do it in the browser, so what
 * lands in `dist/` answers in its own language without running anything
 * (ADR 0003, R13).
 *
 * Three habits keep that honest:
 *
 * - structure is edited before words are swapped. The switch is authored once,
 *   in English, and its `aria-label` is itself translatable, so an edit that
 *   looked for the markup as written would quietly stop matching the Dutch
 *   variant — which is exactly the bug this order avoids;
 * - every deletion is anchored to a string that must appear exactly once, so a
 *   future edit to the source fails the build rather than leaving half a
 *   runtime behind;
 * - nothing here writes an address. Paths come from the route table, host from
 *   the register.
 */
import { company } from "./company.mjs";
import { LANGS, ROOT_LANG, alternateLinks, urlOf } from "./routes.mjs";
import { makeLookup, readDictionary, readPageMeta } from "./dictionary.mjs";
import { applyDictionary, decodeEntities, encodeText, norm } from "./markup.mjs";
import { LEDGER, isLedgered } from "./untranslated.mjs";

/** The authored Page source for the home address, relative to the repo root. */
export const PAGE_SOURCES = Object.freeze({ home: "datawego-company-site.html" });

/** What a `<html lang>` attribute, an `hreflang` value and a `lang` attribute all want. */
const HTML_LANG = Object.freeze({ nl: "nl", en: "en" });

/** `og:locale` insists on a region. `en_US` is the least-bad answer, and is flagged. */
const OG_LOCALE = Object.freeze({ nl: "nl_NL", en: "en_US" });

/**
 * The icons and the social card, named once, by the file a person edits.
 *
 * Repository paths rather than addresses, on purpose: the build names every
 * shipped artwork file from what its bytes contain (ADR 0004), so a URL written
 * here would be a guess about a hash — and a guess that stays green when the
 * artwork is replaced under its own name.
 */
export const SITE_ICONS = Object.freeze([
  { rel: "icon", href: "resources/favicon.svg", type: "image/svg+xml", sizes: "any" },
  { rel: "icon", href: "resources/favicon-32.png", type: "image/png", sizes: "32x32" },
  { rel: "apple-touch-icon", href: "resources/apple-touch-icon.png", sizes: "180x180" },
]);

/** 1200x630 is the ratio every reader that asks for a card at all agrees on. */
const SOCIAL_CARD = Object.freeze({ href: "resources/og-image.jpg", width: 1200, height: 630 });

const LETTER = /[a-z]/i;

/**
 * The strings the runtime translated out of JavaScript rather than out of the
 * document. This is where ADR 0003's measurement undercounted: thirteen
 * dictionary keys belonged to no visible string at all, because they were form
 * and status sentences — `L(f.msg)`, `setStatus(S.sent)`, the theme button's
 * label. Applied here, they stop being runtime data.
 *
 * Each region is bounded by two anchors and matched by its own pattern, because
 * the three shapes differ: `S` is all sentences, `fields` mixes ids with
 * prompts, and the theme label is a choice between two strings. An id is not
 * copy and must not be looked up.
 */
const SCRIPT_STRING_REGIONS = Object.freeze([
  { label: "the send-status sentences", start: "  var S = {", end: "\n  };", pattern: /:\s*"((?:[^"\\]|\\.)*)"/g },
  { label: "the field prompts", start: "  var fields = [", end: "\n  ];", pattern: /\bmsg:\s*"((?:[^"\\]|\\.)*)"/g },
  { label: "the theme label", start: "    var label = ", end: ";", pattern: /"((?:[^"\\]|\\.)*)"/g },
]);

/**
 * Read each region's body, or report the anchor that stopped matching.
 *
 * An anchor that appears twice is reported rather than guessed at, because the
 * second one is a copy of the page's own script somewhere the generator is not
 * looking — and rewriting the wrong one is a silent corruption, not a failure.
 */
function* scriptRegions(html, problems) {
  for (const region of SCRIPT_STRING_REGIONS) {
    const start = html.indexOf(region.start);
    if (start === -1) {
      if (problems) problems.push(`${region.label}: the generator can no longer find ${JSON.stringify(region.start.trim())}`);
      continue;
    }
    if (problems && html.indexOf(region.start, start + 1) !== -1) {
      problems.push(`${region.label}: ${JSON.stringify(region.start.trim())} appears more than once, so the generator cannot tell which region to rewrite`);
      continue;
    }
    const endsAt = html.indexOf(region.end, start);
    if (endsAt === -1) {
      if (problems) problems.push(`${region.label}: ${JSON.stringify(region.start.trim())} is never closed`);
      continue;
    }
    yield { region, start, stop: endsAt + region.end.length, body: html.slice(start, endsAt + region.end.length) };
  }
}

/** Every literal the script-side translator would be asked about, for the freshness check. */
function scriptStringLiterals(html) {
  const literals = [];
  for (const { region, body } of [...scriptRegions(html, null)]) {
    for (const match of body.matchAll(region.pattern)) literals.push({ label: region.label, value: JSON.parse(`"${match[1]}"`) });
  }
  return literals;
}

/**
 * The edits that make the emitted page stop talking to `localStorage` about
 * language, in the order they are applied.
 *
 * `span` removes everything from `start` through the first `end` after it,
 * which is how the runtime loses 360 lines without this file quoting 360 lines.
 */
export function retirements(lang) {
  return [
    {
      label: "the language runtime",
      span: true,
      start: `  /* ── language ─`,
      end: `  if (lang === "nl") renderLang("nl");\n`,
    },
    {
      label: "language boot",
      from: `  /* language boot — resolve before first paint so a Dutch visitor never sees English flash */
  var saved = null;
  try { saved = localStorage.getItem("datawego-lang"); } catch (e) {}
  var lang = (saved === "en" || saved === "nl") ? saved
    : String(navigator.language || navigator.userLanguage || "").toLowerCase().indexOf("nl") === 0 ? "nl" : "en";
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("data-lang", lang);
`,
    },
    {
      label: "the language switch",
      span: true,
      start: `      <div class="lang-switch"`,
      end: `</div>`,
      to: () => languageSwitch(lang),
    },
    {
      label: "the remembered status sentence",
      from: `    statusEN = sentence;\n`,
    },
    {
      label: "the cleared status sentence",
      from: `    statusEN = "";\n`,
    },
    {
      label: "the dictionary lookup in the theme label",
      from: `L(isDark ? "Switch to light theme" : "Switch to dark theme")`,
      to: `isDark ? "Switch to light theme" : "Switch to dark theme"`,
    },
    { label: "the dictionary lookup in a field error", from: `L(f.msg)`, to: `f.msg` },
    { label: "the dictionary lookup in the status line", from: `L(sentence)`, to: `sentence` },
    {
      label: "<html lang>",
      from: `<html lang="${HTML_LANG.en}">`,
      to: `<html lang="${HTML_LANG[lang]}">`,
    },
  ];
}

/**
 * The control becomes two links, which is the only shape that tells a crawler
 * the other language exists (ADR 0003's consequence). `aria-current` marks the
 * variant being read; `aria-pressed` stays in the CSS selector, because the
 * authored source still renders buttons when it is opened from disk.
 */
export function languageSwitch(lang) {
  const items = LANGS.map((other) => {
    const current = other === lang ? ' aria-current="true"' : "";
    return `        <a class="lang-btn" href="${urlOf("home", other)}" hreflang="${HTML_LANG[other]}" lang="${HTML_LANG[other]}"${current}>${other.toUpperCase()}</a>`;
  });
  return `      <div class="lang-switch" role="group" aria-label="Language" data-od-id="nav-lang-switch">\n${items.join("\n")}\n      </div>`;
}

/** Apply one anchored edit, loudly. A silent miss is how a runtime survives its own retirement. */
function applyEdit(html, edit, problems) {
  const replacement = typeof edit.to === "function" ? edit.to() : edit.to ?? "";

  if (edit.span) {
    const start = html.indexOf(edit.start);
    if (start === -1) {
      problems.push(`${edit.label}: the source no longer holds the code this generator removes (looked for ${JSON.stringify(edit.start.trim())})`);
      return html;
    }
    if (html.indexOf(edit.start, start + 1) !== -1) {
      problems.push(`${edit.label}: ${JSON.stringify(edit.start.trim())} appears more than once, so the span is no longer one span`);
      return html;
    }
    const endsAt = html.indexOf(edit.end, start);
    if (endsAt === -1) {
      problems.push(`${edit.label}: the span that starts at ${JSON.stringify(edit.start.trim())} never ends`);
      return html;
    }
    const stop = endsAt + edit.end.length;
    return replacement === undefined
      ? html.slice(0, start) + html.slice(stop)
      : html.slice(0, start) + replacement + html.slice(stop);
  }

  const first = html.indexOf(edit.from);
  if (first === -1) {
    problems.push(`${edit.label}: the source no longer holds ${JSON.stringify(edit.from)}`);
    return html;
  }
  if (html.indexOf(edit.from, first + 1) !== -1) {
    problems.push(`${edit.label}: ${JSON.stringify(edit.from)} appears more than once, so the edit is no longer one edit`);
    return html;
  }
  return html.slice(0, first) + replacement + html.slice(first + edit.from.length);
}

/**
 * Swap each literal a region declares, and fail on one the dictionary lost.
 *
 * The edits are measured on the string that was read and applied in one pass.
 * Splicing region by region looks equivalent and is not: the first rewrite
 * changes the length, so every later region lands at a stale offset and the
 * page is written over itself. That is how the Dutch home page once shipped a
 * contact form whose script ended in `};again."`.
 */
function translateScriptStrings(html, { lookup, problems }) {
  const edits = [];
  for (const { region, start, stop, body } of [...scriptRegions(html, problems)]) {
    let touched = 0;
    const rewritten = body.replace(region.pattern, (whole, value) => {
      const key = JSON.parse(`"${value}"`);
      const dutch = lookup(null, key);
      if (dutch === null) {
        problems.push(`${region.label}: no Dutch for ${JSON.stringify(key)} — the dictionary lost a sentence`);
        return whole;
      }
      touched += 1;
      return whole.slice(0, whole.length - JSON.stringify(value).length) + JSON.stringify(dutch);
    });
    if (!touched) problems.push(`${region.label}: no literal was rewritten, so the region moved without the generator noticing`);
    if (rewritten !== body) edits.push({ start, stop, text: rewritten, label: region.label });
  }

  edits.sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const edit of edits) {
    if (edit.start < cursor) {
      problems.push(`${edit.label}: its region overlaps a region the generator already rewrote, so the anchors are no longer independent`);
      continue;
    }
    out += html.slice(cursor, edit.start) + edit.text;
    cursor = edit.stop;
  }
  return out + html.slice(cursor);
}

/**
 * The chrome split (ADR 0004): what is identical at every address stops being
 * part of the document and becomes a file the browser fetches once.
 *
 * The authored file keeps its inline CSS and JS — it is a prototype, and it is
 * what a reader opens to see the page. Only the emitted page is split, which is
 * also why a generated page opened from disk is unstyled: its chrome is beside
 * it rather than inside it, and the paths are absolute by design so that all ten
 * addresses name the same two files.
 *
 * Two blocks, one rule each:
 *
 * - every `<style>` in the head, joined in document order, becomes the
 *   stylesheet. A `<style>` inside `<body>` is refused rather than folded in:
 *   that would be one page's own CSS, and ADR 0004 shares chrome, not secrets;
 * - the inline `<script>` after `</head>` becomes the behaviour file. The one in
 *   the head stays inline, because it resolves the theme before first paint and
 *   a file that has to be fetched before the page is legible defeats the point.
 *
 * The build replaces the tokens with the hashed names, so nothing here can know
 * a filename, and a token left unsubstituted is a failed build.
 */
export const CHROME_TOKENS = Object.freeze({
  css: "{{CHROME_CSS}}",
  js: "{{CHROME_JS}}",
  // A third token, and deliberately not a third kind of chrome: `linkChrome`
  // names what `splitChrome` returns, and the boot is never returned by it. It
  // exists so the not-found page can be filled by the same loop that fills the
  // pages, and so a build that forgets to fill it fails the leak check.
  boot: "{{CHROME_BOOT}}",
});

function spans(html, open, close, after = 0) {
  const found = [];
  let i = after;
  while (true) {
    const start = html.indexOf(open, i);
    if (start === -1) break;
    const stop = html.indexOf(close, start);
    if (stop === -1) break;
    found.push({ start, stop, body: html.slice(start + open.length, stop), end: stop + close.length });
    i = stop + close.length;
  }
  return found;
}

function splitChrome(html, problems) {
  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) {
    problems.push("the page has no </head>, so the chrome cannot be told from the copy");
    return { html, chrome: {} };
  }

  const styles = spans(html, "<style>", "</style>");
  if (!styles.length) {
    problems.push("there is no <style> to externalise — is this still the authored Page source?");
    return { html, chrome: {} };
  }
  if (styles.some((block) => block.start > headEnd)) {
    problems.push("a <style> in the body is one page's own CSS, which ADR 0004 does not share");
    return { html, chrome: {} };
  }

  const scripts = spans(html, "<script>", "</script>", headEnd);
  if (scripts.length !== 1) {
    problems.push(
      `the body holds ${scripts.length} inline <script> blocks, and the behaviour file is one file: two would change what runs first when they become one fetch`,
    );
    return { html, chrome: {} };
  }

  // Joined with a newline rather than nothing, because two blocks concatenated
  // edge to edge can merge one block's last declaration into the next rule — and
  // because the whole point of the file is that its order is its meaning.
  const chrome = { css: styles.map((block) => block.body).join("\n"), js: scripts[0].body };
  let out = html;
  for (const block of [...styles, scripts[0]].sort((a, b) => b.start - a.start)) {
    const tag = block === scripts[0]
      ? `<script src="${CHROME_TOKENS.js}" defer></script>`
      : `<link rel="stylesheet" href="${CHROME_TOKENS.css}" />`;
    out = out.slice(0, block.start) + tag + out.slice(block.end);
  }
  return { out, chrome };
}

/**
 * The theme boot, for the one document that is not rendered from a Page source.
 *
 * `404.html` is authored rather than derived (see `src/site/static.mjs`), and it
 * still has to resolve the theme before first paint: a visitor who set dark mode
 * and mistyped a URL must not be landed on white. Copying the block would make
 * two answers to one question, and only one of them gets edited, so this reads it
 * out of the page that already runs it.
 *
 * It is the head's script, not the chrome's. That difference is the whole reason
 * the boot was never externalised: a file that has to be fetched before the page
 * is legible is the thing ADR 0004 refuses to pay twice for.
 */
export function themeBoot(html, problems = []) {
  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) {
    problems.push("the page has no </head>, so its theme boot cannot be told from its behaviour");
    return null;
  }

  const inHead = spans(html, "<script>", "</script>").filter((block) => block.start < headEnd);
  if (inHead.length !== 1) {
    problems.push(
      `the head holds ${inHead.length} inline <script> blocks, and the theme boot is one — whatever the not-found page runs would then be a guess`,
    );
    return null;
  }
  return inHead[0].body;
}

/** The `<head>` block the route table owes this variant, in declaration order. */
export function headBlock({ route, lang, title, description }) {
  const lines = [
    `<title>${encodeText(title)}</title>`,
    `<meta name="description" content="${attr(description)}" />`,
    `<link rel="canonical" href="${urlOf(route.key, lang)}" />`,
  ];
  for (const alt of alternateLinks(route.key)) {
    lines.push(`<link rel="alternate" hreflang="${alt.lang === "x-default" ? "x-default" : HTML_LANG[alt.lang]}" href="${alt.href}" />`);
  }
  lines.push(`<meta name="robots" content="${route.indexable ? "index, follow" : "noindex, follow"}" />`);
  for (const icon of SITE_ICONS) {
    const attrs = [`rel="${icon.rel}"`, `href="${icon.href}"`];
    if (icon.type) attrs.push(`type="${icon.type}"`);
    if (icon.sizes) attrs.push(`sizes="${icon.sizes}"`);
    lines.push(`<link ${attrs.join(" ")} />`);
  }
  lines.push(`<meta property="og:type" content="${route.kind === "page" ? "website" : "article"}" />`);
  lines.push(`<meta property="og:site_name" content="${attr(company.name)}" />`);
  lines.push(`<meta property="og:locale" content="${OG_LOCALE[lang]}" />`);
  lines.push(`<meta property="og:title" content="${attr(title)}" />`);
  lines.push(`<meta property="og:description" content="${attr(description)}" />`);
  lines.push(`<meta property="og:url" content="${urlOf(route.key, lang)}" />`);
  lines.push(`<meta property="og:image" content="${company.origin}/${SOCIAL_CARD.href}" />`);
  lines.push(`<meta property="og:image:width" content="${SOCIAL_CARD.width}" />`);
  lines.push(`<meta property="og:image:height" content="${SOCIAL_CARD.height}" />`);
  // What the card literally holds: the brand band and the mark, no more. An alt
  // that repeats the page description would be the usual lie.
  lines.push(`<meta property="og:image:alt" content="${attr(company.name)}" />`);
  // The one reader that ignores og:image entirely is the one that asks for its
  // own card tag instead (X/Twitter), and it wants it named `twitter:image`.
  lines.push(`<meta name="twitter:card" content="summary_large_image" />`);
  lines.push(`<meta name="twitter:image" content="${company.origin}/${SOCIAL_CARD.href}" />`);
  return lines.join("\n");
}

/** Escape for the inside of an attribute value. */
export function attr(text) {
  return encodeText(text).replace(/"/g, "&quot;");
}

/** The authored `<title>` and description, read back out of the source head. */
function readHeadTexts(html) {
  const title = /<title>([\s\S]*?)<\/title>/.exec(html);
  const description = /<meta name="description" content="([^"]*)"/.exec(html);
  if (!title || !description) {
    throw new Error("the Page source lost its <title> or its description; the generator reads the English pair from the head");
  }
  return { title: decodeEntities(title[1]), description: decodeEntities(description[1]) };
}

/** Every string the runtime would have been asked about, in document order. */
export function visibleStrings(html) {
  const seen = [];
  applyDictionary(html, { lookup: () => null, seen });
  return seen;
}

/**
 * Render one Language variant of one Page.
 *
 * Returns `{ html, problems }`. A non-empty `problems` array is a failed build
 * (R15), not a warning printed and then shipped past.
 */
export function renderVariant({ route, lang, source }) {
  if (!LANGS.includes(lang)) throw new Error(`no such language variant: ${lang}`);
  const problems = [];

  const entries = readDictionary(source);
  const pageMeta = readPageMeta(source);
  const authored = readHeadTexts(source);
  const lookup = makeLookup(entries);

  let html = source;
  for (const edit of retirements(lang)) html = applyEdit(html, edit, problems);

  const title = lang === ROOT_LANG ? pageMeta.titleNl : authored.title;
  const description = lang === ROOT_LANG ? pageMeta.descNl : authored.description;
  html = replaceHead(html, { route, lang, title, description, problems });

  if (lang === ROOT_LANG) {
    accountForEveryString(visibleStrings(html), lookup, problems);
    html = applyDictionary(html, { lookup });
    html = translateScriptStrings(html, { lookup, problems });
  }

  // Last, so every edit above still sees the document as it was authored. What
  // the guards refuse has to be searched for in the chrome as well as the HTML:
  // after this line the script is a separate string, and a runtime that moved
  // into a cached file rather than being deleted would be invisible to the page.
  const { out, chrome } = splitChrome(html, problems);
  const shipped = out + Object.values(chrome).join("");
  if (/var NL = \{/.test(shipped)) problems.push("the Dutch dictionary is still being shipped, page or chrome alike");
  if (/\brenderLang\b/.test(shipped)) problems.push("renderLang survives its retirement, page or chrome alike");
  if (/localStorage\.getItem\("datawego-lang"\)/.test(shipped)) problems.push("the language choice is still read from localStorage");
  if (/localStorage\.setItem\(LANG_KEY/.test(shipped)) problems.push("the language choice is still written to localStorage");
  if (/\bL\(/.test(shipped.replace(/\bparseFloat\(/g, ""))) problems.push("a dictionary lookup call survived into what the page ships");

  return { html: out, chrome, problems, title, description, dictionaryKeys: Object.keys(entries).length };
}

/** Rewrite the authored title + description pair into the full head block. */
function replaceHead(html, { route, lang, title, description, problems }) {
  const authoredPair = /<title>[\s\S]*?<\/title>\n<meta name="description" content="[^"]*" \/>/;
  const found = authoredPair.exec(html);
  if (!found) {
    problems.push("the head no longer reads as the generator expects: <title> followed by the description meta");
    return html;
  }
  return html.slice(0, found.index) + headBlock({ route, lang, title, description }) + html.slice(found.index + found[0].length);
}

/**
 * The dictionary's silence, taken away (ADR 0003): a visible string with neither
 * a Dutch key nor a line in the ledger fails the build, because "falls back to
 * English" is indistinguishable from "was always English" once it ships.
 */
function accountForEveryString(records, lookup, problems) {
  const accounted = new Set();
  for (const record of records) {
    if (!LETTER.test(record.key) || accounted.has(record.key)) continue;
    accounted.add(record.key);
    if (lookup(record.host, record.key) === null && !isLedgered(record.key)) {
      problems.push(
        `no Dutch for ${JSON.stringify(record.key)} (${record.where}${record.host ? ` in <${record.host}>` : ""}) — add a dictionary key or a line in src/site/untranslated.mjs`,
      );
    }
  }
}

/**
 * The two halves of the bargain the source makes, neither of which is visible
 * from either variant:
 *
 * - a ledger entry for a string the page no longer shows;
 * - a dictionary key for a string nothing in the page asks about any more.
 *
 * The second is how thirteen keys came to be decorating a 23KB script, and a
 * dictionary that is allowed to keep dead entries is a dictionary whose live
 * entries stop being trustworthy.
 */
export function sourceProblems(source) {
  const shown = new Set(visibleStrings(source).map((record) => record.key));
  const problems = [];

  for (const text of Object.keys(LEDGER)) {
    if (!shown.has(text)) {
      problems.push(`src/site/untranslated.mjs names "${text}", which the Page source no longer shows — remove the entry (${LEDGER[text].why})`);
    }
  }

  const entries = readDictionary(source);
  const lookup = makeLookup(entries);
  const used = new Set();
  for (const record of visibleStrings(source)) {
    if (record.host && Object.prototype.hasOwnProperty.call(entries, `${record.host}|${record.key}`)) {
      used.add(`${record.host}|${record.key}`);
    } else if (Object.prototype.hasOwnProperty.call(entries, record.key)) {
      used.add(record.key);
    }
  }
  for (const literal of scriptStringLiterals(source)) {
    if (Object.prototype.hasOwnProperty.call(entries, literal.value)) used.add(literal.value);
  }
  for (const key of Object.keys(entries)) {
    if (!used.has(key)) {
      problems.push(`the dictionary holds "${key}", which nothing in the Page source says — remove the key or find the string that lost it`);
    }
  }

  return problems;
}

/** Kept for the tests and for a reader who wants one question at a time. */
export function ledgerProblems(source) {
  return sourceProblems(source).filter((problem) => problem.includes("untranslated.mjs"));
}
