/**
 * The smallest HTML walker the dictionary application needs, and the reason it
 * is safe to run at build time.
 *
 * `renderLang` did this job in a browser, where the DOM supplied the tree for
 * free. Generating a variant (ADR 0003) needs the same two facts out of a
 * string: the value of each text node, with the tag it sits in — because a
 * dictionary key may be qualified as `host|text` — and the value of the four
 * translatable attributes. So this is a tag-stack scanner rather than a parser:
 * no selectors, no normalization, no re-serialization of anything it did not
 * touch.
 *
 * The property that makes that acceptable is asserted in
 * `tests/seo-build.test.mjs`: mapping with an empty dictionary returns the
 * input byte for byte. A scanner that cannot survive a no-op edit cannot be
 * trusted with a real one.
 */

/** Elements whose content is text rather than markup, and never copy. */
const RAW_TEXT = new Set(["script", "style", "textarea", "noscript", "title"]);

/** Never pushed on the stack, so their content belongs to the parent. */
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  middot: "\u00b7", mdash: "\u2014", ndash: "\u2013", hellip: "\u2026",
  copy: "\u00a9", reg: "\u00ae", trade: "\u2122", times: "\u00d7",
  eacute: "\u00e9", egrave: "\u00e8", agrave: "\u00e0", ccedil: "\u00e7",
  uuml: "\u00fc", ouml: "\u00f6", auml: "\u00e4", szlig: "\u00df",
};

/** Markup text -> the string a dictionary key is written against. */
export function decodeEntities(text) {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

const TEXT_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

/** A dictionary value -> markup in text position. */
export function encodeText(text) {
  return text.replace(/[&<>]/g, (ch) => TEXT_ESCAPES[ch]);
}

const ATTR_ESCAPES = { ...TEXT_ESCAPES, '"': "&quot;" };

/** A dictionary value -> markup in a double-quoted attribute value. */
export function encodeAttr(text) {
  return text.replace(/[&<>"]/g, (ch) => ATTR_ESCAPES[ch]);
}

/** What `norm()` in the runtime measured, reproduced exactly. */
export function norm(text) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Split markup into a flat list of tokens: `{ kind, start, end, … }` with byte
 * offsets back into `html`, so an edit can be a splice rather than a rebuild.
 */
function tokenize(html) {
  const tokens = [];
  const stack = [];
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      pushText(html, i, html.length, stack);
      break;
    }
    if (lt > i) pushText(html, i, lt, stack);

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt);
      const stop = end === -1 ? html.length : end + 3;
      tokens.push({ kind: "comment", start: lt, end: stop });
      i = stop;
      continue;
    }
    if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      tokens.push({ kind: "declaration", start: lt, end: stop });
      i = stop;
      continue;
    }
    if (html.startsWith("</", lt)) {
      const stop = html.indexOf(">", lt);
      const name = html.slice(lt + 2, stop === -1 ? undefined : stop).trim().toLowerCase();
      if (stop !== -1) {
        tokens.push({ kind: "close", start: lt, end: stop + 1, name });
        for (let k = stack.length - 1; k >= 0; k -= 1) {
          if (stack[k].name === name) {
            stack.length = k;
            break;
          }
        }
      }
      i = stop === -1 ? html.length : stop + 1;
      continue;
    }

    const tag = readTag(html, lt);
    if (!tag) {
      // A stray `<` in prose. Treat the rest as text rather than guess.
      pushText(html, lt, html.length, stack);
      break;
    }
    const host = hostOf(stack);
    tokens.push({
      kind: "open", start: lt, end: tag.end, name: tag.name,
      attrs: tag.attrs, selfClosing: tag.selfClosing, host,
    });
    if (!tag.selfClosing && !VOID_TAGS.has(tag.name)) {
      stack.push({ name: tag.name });
      if (RAW_TEXT.has(tag.name)) {
        // Raw-text content runs to the matching close tag, markup or not.
        const closer = html.toLowerCase().indexOf(`</${tag.name}`, tag.end);
        const stop = closer === -1 ? html.length : closer;
        if (stop > tag.end) tokens.push({ kind: "rawtext", start: tag.end, end: stop, name: tag.name });
        i = stop;
        continue;
      }
    }
    i = tag.end;
  }

  return tokens;

  function pushText(source, from, to, frame) {
    const value = source.slice(from, to);
    if (!value) return;
    tokens.push({ kind: "text", start: from, end: to, value, host: hostOf(frame) });
  }
}

function hostOf(stack) {
  return stack.length ? stack[stack.length - 1].name : null;
}

/** One `<tag …>`, with its attributes as written, quote- and `>`-aware. */
function readTag(html, start) {
  const nameMatch = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(start, start + 64));
  if (!nameMatch) return null;
  const name = nameMatch[1].toLowerCase();

  const attrs = [];
  let i = start + nameMatch[0].length;
  let selfClosing = false;

  for (;;) {
    while (i < html.length && /\s/.test(html[i])) i += 1;
    if (i >= html.length) return null;
    const ch = html[i];
    if (ch === ">") { i += 1; break; }
    if (ch === "/" && html[i + 1] === ">") { selfClosing = true; i += 2; break; }
    if (ch === "/") { i += 1; continue; }

    const attrStart = i;
    while (i < html.length && !/[\s=>/]/.test(html[i])) i += 1;
    const attrName = html.slice(attrStart, i).toLowerCase();
    if (!attrName) { i += 1; continue; }

    let j = i;
    while (j < html.length && /\s/.test(html[j])) j += 1;
    let raw = html.slice(attrStart, j);
    let value = null;

    if (html[j] === "=") {
      j += 1;
      while (j < html.length && /\s/.test(html[j])) j += 1;
      const quote = html[j];
      if (quote === '"' || quote === "'") {
        const end = html.indexOf(quote, j + 1);
        if (end === -1) return null;
        value = html.slice(j + 1, end);
        raw = html.slice(attrStart, end + 1);
        i = end + 1;
      } else {
        const end = i = skipBareValue(html, j);
        value = html.slice(j, end);
        raw = html.slice(attrStart, end);
      }
    }
    attrs.push({ name: attrName, raw, value, start: attrStart, end: i });
  }

  return { name, attrs, selfClosing, end: i };
}

function skipBareValue(html, from) {
  let i = from;
  while (i < html.length && !/[\s>]/.test(html[i])) i += 1;
  return i;
}

/**
 * Rewrite one page's text nodes and translatable attributes through `lookup`.
 *
 * `lookup(host, text)` returns the replacement or `null` to leave the string
 * alone, and reports the strings it was asked about either way, so the build
 * can fail on a missing key instead of falling back to English in silence
 * (ADR 0003).
 */
export function applyDictionary(html, { lookup, seen, attributes = TRANSLATABLE_ATTRS }) {
  const edits = [];

  for (const token of tokenize(html)) {
    if (token.kind === "text") {
      const key = norm(decodeEntities(token.value));
      if (!key) continue;
      seen?.push({ where: "text", host: token.host, key });
      const value = lookup(token.host, key);
      if (value === null || value === undefined) continue;
      if (value === key) continue;
      // The runtime preserved the node's own leading and trailing whitespace.
      const lead = /^\s*/.exec(token.value)[0];
      const tail = /\s*$/.exec(token.value)[0];
      edits.push({ start: token.start, end: token.end, text: lead + encodeText(value) + tail });
      continue;
    }
    if (token.kind !== "open") continue;
    for (const attr of token.attrs) {
      if (!attributes.includes(attr.name) || attr.value === null) continue;
      const key = norm(decodeEntities(attr.value));
      if (!key) continue;
      seen?.push({ where: `@${attr.name}`, host: token.name, key });
      const value = lookup(token.name, key);
      if (value === null || value === undefined || value === key) continue;
      edits.push({ start: attr.start, end: attr.end, text: attr.name + '="' + encodeAttr(value) + '"' });
    }
  }

  edits.sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const edit of edits) {
    if (edit.start < cursor) throw new Error("overlapping markup edits");
    out += html.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return out + html.slice(cursor);
}

/** The four attributes `renderLang` collected, in the same order. */
export const TRANSLATABLE_ATTRS = Object.freeze(["alt", "placeholder", "aria-label", "title"]);
