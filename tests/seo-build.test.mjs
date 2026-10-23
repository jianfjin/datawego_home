/**
 * Guard tests for the generator (U2).
 *
 * U2's claim is narrow and load-bearing: the two addresses the site ships today
 * carry their own language's prose in the served bytes with no JavaScript run
 * (R1), every address they name is the route table's (R3, R4), the runtime that
 * used to do this in the browser is gone and the theme toggle that was never
 * part of it is not (R13), and a mistake in the source stops the build instead
 * of shipping quietly (R15, ADR 0003).
 *
 * Most of these are negative on purpose, because the failure this unit is
 * allowed to make is the pleasant one: a variant that looks finished and is
 * half English, or a page whose script was written over at the wrong offset.
 * Both parse as HTML either way.
 *
 * Nothing here reads `dist/` — `generate()` works in memory, so a stale build
 * directory can never make this suite pass, and the suite never writes one.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import { generate, distPath, pageSourceFor } from "../build.mjs";
import { company } from "../src/site/company.mjs";
import {
  LANGS,
  ROUTES,
  X_DEFAULT_LANG,
  alternateLinks,
  isVariantBearing,
  routeByKey,
  sitemapUrls,
  urlOf,
} from "../src/site/routes.mjs";
import { makeLookup, readDictionary } from "../src/site/dictionary.mjs";
import { applyDictionary, encodeText } from "../src/site/markup.mjs";
import { isLedgered } from "../src/site/untranslated.mjs";
import { languageSwitch, PAGE_SOURCES, renderVariant, sourceProblems, visibleStrings } from "../src/site/page.mjs";

const ROOT = new URL("..", import.meta.url);
const read = (relative) => fs.readFileSync(new URL(relative, ROOT), "utf8");

/** The one Page source that exists today, and the route that ships it. */
const SOURCE = read("datawego-company-site.html");
const home = routeByKey.get("home");

const entries = readDictionary(SOURCE);
const lookup = makeLookup(entries);

/** The source's visible strings, as a set: what a variant may not silently change. */
const SOURCE_STRINGS = new Set(visibleStrings(SOURCE).map((record) => record.key));

const RENDERED = new Map();
function variant(lang) {
  if (!RENDERED.has(lang)) {
    const out = renderVariant({ route: home, lang, source: SOURCE });
    assert.deepEqual(out.problems, [], `rendering the live home source as ${lang} must report nothing`);
    RENDERED.set(lang, out);
  }
  return RENDERED.get(lang);
}

/** Re-render with one edit made to the source, to prove an edit is caught. */
function renderWith(lang, edit) {
  const mutated = edit(SOURCE);
  assert.notEqual(mutated, SOURCE, "the test's own edit changed nothing, so it proves nothing");
  return renderVariant({ route: home, lang, source: mutated });
}

function inlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

/** Every visible string in `html` that a dictionary key could have replaced. */
function untranslated(html) {
  return visibleStrings(html).filter((record) => {
    const value = lookup(record.host, record.key);
    return value !== null && value !== record.key;
  });
}

// ── the translator, in isolation ────────────────────────────────────────────

test("a dictionary that refuses to translate changes nothing, byte for byte", () => {
  // The identity property. Without it, "apply the dictionary" is really
  // "re-serialise the document", and every untranscribed byte becomes the
  // generator's fault instead of the source's.
  assert.equal(applyDictionary(SOURCE, { lookup: () => null }), SOURCE);
  assert.equal(applyDictionary("<p>a &amp; b</p><img alt=\"x'y\">", { lookup: () => null }), "<p>a &amp; b</p><img alt=\"x'y\">");
});

test("a translation is re-encoded, not pasted raw into the markup", () => {
  const html = "<p>Cost &amp; value</p><img alt=\"Cost &amp; value\">";
  const out = applyDictionary(html, { lookup: () => "Prijs & <waarde>." });
  assert.equal(
    out,
    "<p>Prijs &amp; &lt;waarde&gt;.</p><img alt=\"Prijs &amp; &lt;waarde&gt;.\">",
    "text nodes and attribute values each get their own escaping, and the quote is what ends an attribute",
  );
});

test("the dictionary's host rule wins, and only for the tag it names", () => {
  const qualified = makeLookup({ Model: "Mapper", "dt|Model": "Model" });
  assert.equal(qualified("dt", "Model"), "Model", "a qualified key exists because the bare one is wrong there");
  assert.equal(qualified("h3", "Model"), "Mapper");
  assert.equal(makeLookup({ Model: "Mapper" })("dt", "Model"), "Mapper", "an unqualified page falls back to the bare key");
  assert.equal(qualified("dt", "Nothing"), null, "no key is not an empty translation");
});

test("script and style bodies are markup, not prose", () => {
  // This is why the tokenizer tracks raw-text elements at all: the dictionary
  // itself lives in a <script>, and a translator that saw its English keys as
  // text would translate the keys out from under itself.
  const html = "<script>var x = \"Ingest\";</script><style>.a::after{content:\"Ingest\"}</style><p>Ingest</p>";
  const out = applyDictionary(html, { lookup: () => "Ophalen" });
  assert.equal(out, "<script>var x = \"Ingest\";</script><style>.a::after{content:\"Ingest\"}</style><p>Ophalen</p>");
});

test("a string is reported whether or not it was translated", () => {
  // ADR 0003 needs the strings a variant *kept*, or a missing key is
  // indistinguishable from a page that was always English.
  const seen = [];
  applyDictionary("<p>Ingest</p><p>Unknown string</p>", { lookup: () => null, seen });
  assert.deepEqual(seen.map((record) => record.key), ["Ingest", "Unknown string"]);
});

// ── what the two variants contain ───────────────────────────────────────────

test("the Dutch variant leaves no English prose behind", () => {
  const residual = untranslated(variant("nl").html);
  assert.deepEqual(
    residual.map((record) => `${record.where}${record.host ? `<${record.host}>` : ""}:${record.key}`),
    [],
    "every visible string with a dictionary key must be in Dutch in the Dutch address (R1)",
  );
});

test("the English variant is the source's own words, unchanged", () => {
  // The other half of R1, and the half a translator breaks by accident: an edit
  // keyed on text rather than position can reach into the English variant too.
  const shown = new Set(visibleStrings(variant("en").html).map((record) => record.key));
  assert.deepEqual([...shown].filter((key) => !SOURCE_STRINGS.has(key)), [], "the English variant invented a string");
  assert.deepEqual([...SOURCE_STRINGS].filter((key) => !shown.has(key)), [], "the English variant lost a string");
});

test("whatever English survives into the Dutch page is on the ledger, and nowhere else", () => {
  // The ledger is the whole answer to "why is this English on a Dutch page".
  // If a survivor is missing from it, the build's parity rule has a hole. If it
  // is in it and also in the dictionary, the two mechanisms disagree.
  const survivors = visibleStrings(variant("nl").html)
    .map((record) => record.key)
    .filter((key) => SOURCE_STRINGS.has(key) && /[a-z]/i.test(key));
  assert.deepEqual(
    [...new Set(survivors)].filter((key) => !isLedgered(key)).sort(),
    [],
    "untranslated Dutch-market copy — add a key or a line in src/site/untranslated.mjs",
  );
  const dutch = new Set(Object.values(entries));
  for (const key of new Set(survivors)) {
    assert.ok(!dutch.has(key), `"${key}" is both a survivor and someone's translation; check the ledger's reason`);
  }
});

test("the head agrees with the route table, in both languages", () => {
  for (const lang of LANGS) {
    const html = variant(lang).html;
    const own = urlOf("home", lang);
    const canonical = /<link rel="canonical" href="([^"]*)"/.exec(html);
    assert.ok(canonical, `${lang}: no canonical`);
    assert.equal(canonical[1], own, `${lang}: the canonical is not the address the route table declares`);
    assert.equal(/<meta property="og:url" content="([^"]*)"/.exec(html)[1], own, `${lang}: og:url split from the canonical`);
    assert.ok(sitemapUrls().includes(own), `${lang}: the variant is not in its own sitemap`);

    const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)]
      .map(([, hreflang, href]) => [hreflang, href]);
    assert.deepEqual(
      alternates,
      alternateLinks("home").map((link) => [link.lang, link.href]),
      `${lang}: the page's alternates were derived from something other than the route table`,
    );
    assert.deepEqual(alternates.map((pair) => pair[0]).sort(), ["en", "nl", "x-default"], `${lang}: hreflang set`);
    assert.deepEqual(
      Object.fromEntries(alternates)["x-default"],
      urlOf("home", X_DEFAULT_LANG),
      "x-default is the language a visitor who asked for neither gets (ADR 0001)",
    );
    assert.match(html, new RegExp(`<html lang="${lang}">`), `${lang}: <html lang> disagrees with the address`);
    assert.match(html, /<meta name="robots" content="index, follow" \/>/, "an indexable Page must not tell Google to skip it");
  }
});

test("the title and description each variant serves are the ones it claims", () => {
  const nl = variant("nl");
  const en = variant("en");
  assert.match(nl.title, /^DataWeGo — /, "the Dutch title is the dictionary's, not the authored one");
  assert.notEqual(nl.title, en.title);
  assert.notEqual(nl.description, en.description);
  for (const [name, out] of [["nl", nl], ["en", en]]) {
    assert.equal(new RegExp(`<title>([\\s\\S]*?)</title>`).exec(out.html)[1], encodeText(out.title), `${name}: title tag`);
    assert.equal(
      new RegExp(`<meta property="og:title" content="([^"]*)"`).exec(out.html)[1],
      encodeText(out.title).replace(/"/g, "&quot;"),
      `${name}: og:title must not state a second title`,
    );
    assert.equal(
      new RegExp(`<meta name="description" content="([^"]*)"`).exec(out.html)[1],
      encodeText(out.description).replace(/"/g, "&quot;"),
      `${name}: description`,
    );
  }
});

test("the language runtime is retired, and the theme toggle is not", () => {
  // Both halves are R13. The first is what a crawler sees. The second is what
  // a visitor keeps: the retirement span is 371 lines wide and ends four lines
  // before `var THEME_KEY`, so a span that overshoots takes the toggle's memory
  // with the language machinery, and the page still looks fine.
  for (const lang of LANGS) {
    const { html } = variant(lang);
    assert.ok(!/var NL = \{/.test(html), `${lang}: the dictionary is still being shipped as runtime data`);
    assert.ok(!/\brenderLang\b/.test(html), `${lang}: renderLang survives its retirement`);
    assert.ok(!html.includes("datawego-lang"), `${lang}: the language choice is still remembered`);
    assert.ok(html.includes('localStorage.getItem("datawego-theme")'), `${lang}: the theme stopped working`);
    assert.ok(!/\bL\(/.test(html.replace(/\bparseFloat\(/g, "")), `${lang}: a dictionary lookup call is still in the page`);
  }
  assert.equal(variant("nl").dictionaryKeys, Object.keys(entries).length, "the dictionary read must be the whole dictionary");
});

test("the language switch became two links, and marks the one being read", () => {
  for (const lang of LANGS) {
    const switchMarkup = /<div class="lang-switch"[\s\S]*?<\/div>/.exec(variant(lang).html)?.[0];
    assert.ok(switchMarkup, `${lang}: the switch is no longer the block the generator replaces`);
    assert.equal(switchMarkup.match(/<a class="lang-btn"/g).length, 2, `${lang}: the switch must be exactly two links`);
    assert.ok(!switchMarkup.includes("<button"), `${lang}: a control that changes the page in place is invisible to a crawler`);
    assert.equal(switchMarkup.match(/aria-current="true"/g).length, 1, `${lang}: aria-current must mark one variant`);
    for (const other of LANGS) {
      assert.ok(switchMarkup.includes(`href="${urlOf("home", other)}"`), `${lang}: no link to the ${other} variant`);
    }
    const anchors = (markup) =>
      markup.split("\n").map((line) => line.trim()).filter((line) => line.includes('class="lang-btn"'));
    assert.deepEqual(
      anchors(switchMarkup),
      anchors(languageSwitch(lang)),
      `${lang}: the switch in the page is not the links the generator wrote`,
    );
    // The label is the one thing that must differ, and it differs because
    // structure is edited before words: the generator deletes the authored
    // switch while `aria-label="Language"` is still in it, and the dictionary
    // pass translates the label afterwards. Reverse the two and the anchor for
    // the whole deletion stops matching the Dutch variant.
    const label = /<div class="lang-switch" role="group" aria-label="([^"]*)"/.exec(switchMarkup)[1];
    assert.equal(label, lang === "nl" ? "Taal" : "Language", `${lang}: the switch's own label`);
  }
});

test("every inline script in every variant still parses", () => {
  // The regression this exists for: three script regions were spliced one after
  // another, each into a string the previous splice had already resized, so the
  // Dutch home page shipped a contact form whose script read
  // `…};again."\n  };` and died at the first line. HTML stays valid when that
  // happens. JavaScript does not.
  for (const lang of LANGS) {
    const scripts = inlineScripts(variant(lang).html);
    assert.ok(scripts.length >= 2, `${lang}: expected the boot script and the form script`);
    scripts.forEach((code, i) => {
      assert.doesNotThrow(() => new vm.Script(code), {
        message: `${lang}: inline script #${i} does not parse — the generator wrote over itself`,
      });
    });
  }
});

test("the sentences that lived in JavaScript are Dutch where they are shown", () => {
  // The runtime translated thirteen keys that belonged to no visible string:
  // the send-status panel, the field prompts, the theme button's label. A
  // page whose prose is Dutch and whose error messages are English is the
  // half-translation ADR 0003 was written against.
  const nl = variant("nl").html;
  const en = variant("en").html;
  for (const [english, dutch] of [
    ["Sent. We'll reply to the address you gave.", "Verstuurd. We antwoorden op het adres dat je opgaf."],
    ["The security check isn't ready yet", "De beveiligingscontrole is nog niet klaar"],
    ["Enter a valid email address.", "Vul een geldig e-mailadres in."],
    ["Switch to light theme", "Wissel naar lichte modus"],
  ]) {
    assert.ok(en.includes(english), `the English variant lost ${JSON.stringify(english)}`);
    assert.ok(nl.includes(dutch), `the Dutch variant never said ${JSON.stringify(dutch)}`);
    assert.ok(!nl.includes(english), `the Dutch variant still says ${JSON.stringify(english)}`);
  }
  assert.equal(nl.match(/msg: "[^"]*"/g).length, 3, "the prompts are no longer three, so the region the generator rewrites has moved");
});

test("no variant is the source file, and the source is not what deploys", () => {
  // The one line in the old deploy.js that would have published English at the
  // Dutch address. If the source ever becomes a served file again, this fails.
  const generated = generate();
  assert.deepEqual(generated.problems, [], "the tree as committed must build");
  for (const [name, bytes] of generated.files) {
    assert.ok(
      Buffer.from(bytes).equals(Buffer.from(SOURCE)) === false,
      `${name} is a byte copy of the Page source, which is English with a runtime attached`,
    );
  }
});

// ── the build refuses ───────────────────────────────────────────────────────

test("a visible string that loses its Dutch key fails the build", () => {
  const out = renderWith("nl", (source) => source.replace('    "Capabilities": "Wat we doen",\n', ""));
  assert.ok(
    out.problems.some((problem) => problem.includes('no Dutch for "Capabilities"')),
    `expected a missing-key refusal, got:\n  - ${out.problems.join("\n  - ")}`,
  );
});

test("the failure is Dutch-only: the English variant still renders", () => {
  // R15 is a promise about the Dutch address, not a reason the English one
  // cannot be built while the copy is being fixed.
  const out = renderWith("en", (source) => source.replace('    "Capabilities": "Wat we doen",\n', ""));
  assert.deepEqual(out.problems, []);
});

test("an anchored deletion that stops matching is reported, not skipped", () => {
  // Every retirement is anchored to a string that must appear exactly once. A
  // silent miss is how a runtime survives its own retirement.
  const missing = renderWith("nl", (source) => source.replace("  /* ── language ─", "  /* ── klantale ─"));
  assert.ok(
    missing.problems.some((problem) => problem.includes("the source no longer holds the code this generator removes")),
    `expected an anchor refusal, got:\n  - ${missing.problems.join("\n  - ")}`,
  );

  const duplicated = renderWith("nl", (source) => {
    const anchor = "  var fields = [";
    const at = source.indexOf(anchor);
    return source.slice(0, at) + anchor + "\n  ];\n" + source.slice(at);
  });
  assert.ok(
    duplicated.problems.some((problem) => problem.includes("appears more than once")),
    "an ambiguous anchor must not be resolved by guessing",
  );
});

test("a ledger entry for a string the page no longer shows fails the build", () => {
  const problems = sourceProblems(SOURCE.replace("CONTROL PLANE", "BEHEERLAAG"));
  assert.ok(
    problems.some((problem) => problem.includes("CONTROL PLANE") && problem.includes("untranslated.mjs")),
    `expected a stale-ledger refusal, got:\n  - ${problems.join("\n  - ")}`,
  );
  assert.ok(isLedgered("CONTROL PLANE"), "and the entry this test relies on is still there");
});

test("a dictionary key nobody says any more fails the build", () => {
  const problems = sourceProblems(
    SOURCE.replace("  var NL = {\n", '  var NL = {\n    "Een zin die nergens staat": "niets",\n'),
  );
  assert.ok(
    problems.some((problem) => problem.includes("Een zin die nergens staat") && problem.includes("nothing in the Page source says")),
    `expected a dead-key refusal, got:\n  - ${problems.join("\n  - ")}`,
  );
});

test("the source as committed is on speaking terms with both mechanisms", () => {
  assert.deepEqual(sourceProblems(SOURCE), [], "the ledger and the dictionary are both current");
});

// ── the files the build claims to write ─────────────────────────────────────

test("every name the build emits is a path inside dist/", () => {
  const dist = path.resolve(ROOT.pathname, "dist");
  for (const name of generate().files.keys()) {
    assert.ok(!path.isAbsolute(name), `${name} is absolute, so it escapes the build directory`);
    assert.ok(!name.split("/").includes(".."), `${name} climbs out of the build directory`);
    assert.ok(path.resolve(dist, name).startsWith(dist + path.sep), `${name} resolves outside dist/`);
  }
});

test("an address maps to a file the way Pages expects to find it", () => {
  assert.equal(distPath(home, "nl"), "index.html");
  assert.equal(distPath(home, "en"), path.join("en", "index.html"));
  const practice = routeByKey.get("dataplatforms");
  assert.equal(distPath(practice, "nl"), path.join("dataplatforms", "index.html"));
  assert.equal(distPath(practice, "en"), path.join("en", "data-platforms", "index.html"));
  const diagram = routeByKey.get("diagram-pharm-platform");
  assert.equal(distPath(diagram, "nl"), path.join("docs", "pharm-platform.html"));
});

test("today's build is two pages, four diagrams, the Functions routing map, and the images", () => {
  const { files } = generate();
  const pages = [...files.keys()].filter((name) => name.endsWith("index.html")).sort();
  assert.deepEqual(pages, ["en/index.html", "index.html"], "Stage 1 ships two addresses and no more");
  assert.ok(files.has("_routes.json"), "without it the contact API stops being a Function");
  assert.match(files.get("_routes.json"), /"\/api\/\*"/);

  const diagrams = ROUTES.filter((route) => route.kind === "diagram");
  assert.equal(diagrams.length, 4);
  for (const route of diagrams) {
    const name = distPath(route, "nl");
    assert.ok(files.has(name), `${name} was not copied`);
    const original = fs.readFileSync(new URL(`../docs/${path.basename(route.path.nl)}`, import.meta.url));
    assert.ok(Buffer.from(files.get(name)).equals(original), `${name} was rewritten; the diagrams' drawings are out of scope (R8)`);
  }

  const assets = [...files.keys()].filter((name) => name.startsWith("resources/"));
  assert.ok(assets.length >= 2, "the page's own images were not copied, so they would 404 where they are served");
  for (const name of assets) {
    const onDisk = fs.readFileSync(new URL(`../${name}`, import.meta.url));
    assert.ok(Buffer.from(files.get(name)).equals(onDisk), `${name} is not the file on disk`);
  }
});

test("a route that goes live without copy stops the build rather than shipping a placeholder", () => {
  // R16: a page ships with its words or does not ship. `pageSourceFor` is the
  // gate, and it is loud on purpose — the quiet alternative is an empty Dutch
  // practice area arriving in a search result, which is worse than no page.
  assert.equal(pageSourceFor(routeByKey.get("home")), "datawego-company-site.html");
  assert.throws(
    () => pageSourceFor(routeByKey.get("dataplatforms")),
    /no Page source is registered.*ships with its words or does not ship/s,
  );
  for (const [key, file] of Object.entries(PAGE_SOURCES)) {
    assert.ok(fs.existsSync(new URL(`../${file}`, import.meta.url)), `the source registered for ${key} does not exist`);
    assert.equal(routeByKey.get(key).status, "live", `${key} has a source but is not live: the table and the build disagree`);
  }

  const planned = ROUTES.filter((route) => route.status === "planned");
  assert.equal(planned.length, 4, "Stage 2's four surfaces are declared and not yet live");
  for (const route of planned) {
    assert.ok(isVariantBearing(route) && route.indexable, `${route.key}: a planned surface must be an indexable Page`);
    assert.ok(!Object.hasOwn(PAGE_SOURCES, route.key), `${route.key} is planned but already has a source`);
    assert.ok(!urlOf(route.key, "nl").includes("/nl/"), `${route.key}: Dutch owns the root (ADR 0001)`);
  }
});

test("the company facts the head states are the register's", () => {
  // Nothing in a variant may state a company fact the register does not carry.
  assert.ok(variant("nl").html.includes(company.name));
  assert.match(variant("nl").html, new RegExp(`<meta property="og:site_name" content="${company.name}"`));
  // Decision A, taken 2026-10-23: the street line leaves the footer and the
  // register stays at city level. U3 makes the first half, so what has to be
  // true now is that the two halves cannot be undone apart. Whichever side of
  // the change a later edit forgets, one of these two assertions catches.
  const street = ["Spieringdam 1", "2492 ND Den Haag", "The Netherlands"];
  const shown = street.filter((line) => SOURCE_STRINGS.has(line));
  const excused = street.filter((line) => isLedgered(line) || Object.hasOwn(entries, line));
  assert.deepEqual(shown, excused, "the footer address, its two ledger entries and the dictionary key for its third line are one change (decision A)");
  assert.equal(company.streetAddress, null, "the city, not the street (ADR 0011's second amendment)");
  assert.equal(shown.length, 3, "and today the page does still show all three, because U3 has not run")
});
