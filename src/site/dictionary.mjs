/**
 * The Dutch dictionary read out of the Page source, as build input.
 *
 * ADR 0003 keeps the dictionary's content job and takes away its silence, which
 * needs two things: the exact lookup rules `renderLang` used, and a build that
 * fails when a visible string has no key. The format therefore survives as it
 * stands — 206-odd entries of exact source strings, some qualified by the tag
 * they appear in — rather than being rewritten into a new file the day's copy
 * edit can drift from.
 *
 * Parsing is deliberately not a regex over the whole script: the object literal
 * is located by its declaration and read to its matching brace, then evaluated
 * as the literal it already is. A dictionary that cannot be found is an error,
 * not an empty object.
 */

/** The `host|text` rule, kept from `lookup()` in the runtime. */
export function makeLookup(entries) {
  return function lookup(host, text) {
    if (host && Object.prototype.hasOwnProperty.call(entries, `${host}|${text}`)) {
      return entries[`${host}|${text}`];
    }
    return Object.prototype.hasOwnProperty.call(entries, text) ? entries[text] : null;
  };
}

/** Locate `var NAME = {…};` and return the source between the braces. */
function literal(source, name) {
  const declared = new RegExp(`(?:var|const|let)\\s+${name}\\s*=\\s*\\{`, "m");
  const match = declared.exec(source);
  if (!match) throw new Error(`${name} is no longer declared in the Page source`);
  const open = source.indexOf("{", match.index + match[0].length - 1);

  let depth = 0;
  let i = open;
  let quote = null;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "/" && (source[i + 1] === "/" || source[i + 1] === "*")) {
      const line = source[i + 1] === "/";
      const end = source.indexOf(line ? "\n" : "*/", i + 2);
      i = end === -1 ? source.length : end + (line ? 0 : 1);
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) { i += 1; break; }
    }
  }
  if (depth !== 0) throw new Error(`${name} literal is unbalanced`);
  return source.slice(open, i);
}

/**
 * Evaluate a dictionary literal. Its own braces and quotes are the only things
 * that run, and the result must be a plain object of strings — a function, a
 * computed key or a nested object is a failure, because the build would then be
 * executing page script rather than reading it.
 */
export function readDictionary(source, name = "NL") {
  const body = literal(source, name);
  const entries = new Function(`"use strict"; return (${body});`)();
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    throw new Error(`${name} is not an object literal`);
  }
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value !== "string") {
      throw new Error(`${name}: "${key}" is not a string — the dictionary holds text only`);
    }
  }
  return entries;
}

/**
 * The Dutch `<title>` and description, which the runtime assigned by hand.
 *
 * Only the string literals are read here. The source also carries
 * `titleEn: document.title` and `descEn: ""`, both of which the runtime filled
 * in from the live document, and a build cannot evaluate either. The generator
 * takes the English pair from the `<head>` it is editing, which is the same
 * answer without a second place to keep it true.
 */
export function readPageMeta(source) {
  const body = literal(source, "PAGE");
  const read = (field) => {
    const match = new RegExp(`\\b${field}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "m").exec(body);
    if (!match) {
      throw new Error(`PAGE.${field} is no longer a double-quoted literal in the Page source`);
    }
    return JSON.parse(`"${match[1]}"`);
  };
  return { titleNl: read("titleNl"), descNl: read("descNl") };
}

/**
 * The strings a variant may leave untranslated without failing the build.
 *
 * ADR 0003's measurement found three prose fragments with no Dutch key, and all
 * three proper names. An allowlist is the only honest way to encode "these are
 * names, not English": a wildcard would swallow the next real gap. Adding to
 * this list is a decision, and each entry states whose name it is.
 */
export const PROPER_NAMES = Object.freeze({
  "Pharm Platform": "a case-study title; the platform is named that in the client's own documents",
  "EHR Transform Platform": "a case-study title, as above",
  "Marketing Research Swarm": "a case-study title, as above",
});
