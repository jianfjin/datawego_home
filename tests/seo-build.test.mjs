/**
 * Guard tests for the generator (U2, U3).
 *
 * U3 adds the claim that whatever is identical at every address stops being
 * inside the document (ADR 0004), which is why half of these assertions read a
 * page and its chrome together rather than the page alone.
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
 * U6 adds the four Diagram pages, which are the only documents in the build
 * whose body the repository does not author. Two assertions hold that
 * separation open: everything after `</head>` is byte-for-byte the committed
 * archify file, and everything the page needs in order to stay out of the index
 * is in front of it (R8).
 *
 * Nothing here reads `dist/` — `generate()` works in memory, so a stale build
 * directory can never make this suite pass, and the suite never writes one.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import { generate, distPath, pageSourceFor, shipAssets } from "../build.mjs";
import { company } from "../src/site/company.mjs";
import {
  LANGS,
  ROUTES,
  ROOT_LANG,
  X_DEFAULT_LANG,
  alternateLinks,
  indexablePageRoutes,
  isVariantBearing,
  routeByKey,
  sitemapUrls,
  urlOf,
} from "../src/site/routes.mjs";
import { makeLookup, readDictionary } from "../src/site/dictionary.mjs";
import { PAGE_BODIES } from "../src/site/pages.mjs";
import { visibleWords } from "../src/site/wordcount.mjs";
import { applyDictionary, decodeEntities, encodeText, norm } from "../src/site/markup.mjs";
import { isLedgered } from "../src/site/untranslated.mjs";
import {
  CHROME_TOKENS,
  languageSwitch,
  leakedRouteLinks,
  PAGE_SOURCES,
  renderVariant,
  routeLinkToken,
  sourceProblems,
  themeBoot,
  visibleStrings,
} from "../src/site/page.mjs";
import { bingAuthFile, headersFile, notFoundPage, robotsFile, sitemapXml, staticAssets } from "../src/site/static.mjs";
import { DIAGRAM_HEAD, applyDiagramHead } from "../src/site/diagrams.mjs";

const ROOT = new URL("..", import.meta.url);
const read = (relative) => fs.readFileSync(new URL(relative, ROOT), "utf8");

/** The one Page source that exists today, and the route that ships it. */
const SOURCE = read("datawego-company-site.html");
const home = routeByKey.get("home");

/** The four Bodies U10 wrote copy into, as the build reads them (ADR 0013). */
const BODIES = Object.values(PAGE_BODIES).map(read);

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

/** The script regions a browser actually executes, in document order. */
const EXECUTABLE = /^(?:|(?:text|application)\/(?:x-)?javascript|module)$/;

function inlineScripts(html) {
  // `executes` is the whole filter. U7's JSON-LD is a `<script>` the browser
  // never runs, and counting it as a script would mean either a second theme
  // boot or a data island that fails to parse as JavaScript.
  return [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs]) => !/\bsrc=/.test(attrs) && EXECUTABLE.test((/\btype="([^"]*)"/.exec(attrs) || ["", ""])[1]))
    .map(([, , code]) => code);
}

/** Everything one variant sends: the document, plus the files beside it. */
function shipped(rendered) {
  return rendered.html + Object.values(rendered.chrome).join("");
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

test("the English variant is the source's own words, plus the one sentence the register lends it", () => {
  // The other half of R1, and the half a translator breaks by accident: an edit
  // keyed on text rather than position can reach into the English variant too.
  //
  // Stage 2 adds exactly one permitted exception, and naming it is the point: the
  // sole-practice clause is not page copy but a claim about the company, placed by
  // the generator on every indexable Page in both variants (R12, ADR 0012). A test
  // that allowed "a few added strings" would allow any edit that reaches into the
  // English page, which is the failure this assertion exists to catch.
  const shown = new Set(visibleStrings(variant("en").html).map((record) => record.key));
  assert.deepEqual(
    [...shown].filter((key) => !SOURCE_STRINGS.has(key)),
    [company.practiceClause.en],
    "the English variant invented a string beyond the sole-practice clause",
  );
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

test("every script a variant runs parses, inline or fetched", () => {
  // The regression this exists for: three script regions were spliced one after
  // another, each into a string the previous splice had already resized, so the
  // Dutch home page shipped a contact form whose script read
  // `…};again."\n  };` and died at the first line. HTML stays valid when that
  // happens. JavaScript does not.
  //
  // U3 is why this reads two places now. The behaviour left the document for a
  // cached file, so the same stale-offset splice that once broke a page breaks
  // an asset instead — and that is worse, because the page still looks right
  // until a visitor presses send.
  for (const lang of LANGS) {
    const { html, chrome } = variant(lang);
    const inline = inlineScripts(html);
    assert.equal(inline.length, 1, `${lang}: the theme boot is the only script left inside the document`);
    assert.ok(chrome.js.length > 1000, `${lang}: nothing was externalised, so ADR 0004 did not happen`);
    [...inline, chrome.js].forEach((code, i) => {
      assert.doesNotThrow(() => new vm.Script(code), {
        message: `${lang}: script #${i} does not parse — the generator wrote over itself`,
      });
    });
  }
});

test("the sentences that lived in JavaScript are Dutch where they are shown", () => {
  // The runtime translated thirteen keys that belonged to no visible string:
  // the send-status panel, the field prompts, the theme button's label. A
  // page whose prose is Dutch and whose error messages are English is the
  // half-translation ADR 0003 was written against.
  const nl = shipped(variant("nl"));
  const en = shipped(variant("en"));
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
  const out = renderWith("nl", (source) => source.replace('    "Data platforms": "Dataplatforms",\n', ""));
  assert.ok(
    out.problems.some((problem) => problem.includes('no Dutch for "Data platforms"')),
    `expected a missing-key refusal, got:\n  - ${out.problems.join("\n  - ")}`,
  );
});

test("the failure is Dutch-only: the English variant still renders", () => {
  // R15 is a promise about the Dutch address, not a reason the English one
  // cannot be built while the copy is being fixed.
  const out = renderWith("en", (source) => source.replace('    "Data platforms": "Dataplatforms",\n', ""));
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
  // The Bodies are passed as siblings because since U10 a sentence may live on
  // the site in a Body rather than in the prototype. Read against SOURCE alone,
  // every key U10 wrote would look dead — the wrong answer for the wrong
  // reason — so the two mutations below are what keep this assertion honest.
  assert.deepEqual(sourceProblems(SOURCE, BODIES), [], "the ledger and the dictionary are both current");
});

test("a key only a Body says is alive; a key nothing says is dead", () => {
  const bodyStrings = new Set(BODIES.flatMap((body) => visibleStrings(body).map((record) => record.key)));
  assert.ok(bodyStrings.size > 100, `the Bodies carry the Page copy now, and only ${bodyStrings.size} visible strings were found in them`);

  const bodyOnly = [...bodyStrings].find((key) => !SOURCE_STRINGS.has(key) && key.length > 20);
  assert.ok(bodyOnly, "U10 wrote copy that is nowhere in the prototype, or the first half of this check is vacuous");
  assert.ok(Object.prototype.hasOwnProperty.call(entries, bodyOnly), `${bodyOnly} needs its Dutch somewhere, and the build would have refused it otherwise`);
  assert.deepEqual(
    deadKeys(sourceProblems(SOURCE, BODIES)).filter((problem) => problem.includes(bodyOnly)),
    [],
    "a key whose only speaker is a Body must not read as dead",
  );
  assert.ok(
    deadKeys(sourceProblems(SOURCE)).some((problem) => problem.includes(bodyOnly)),
    "read without the Bodies the same key does read as dead, which is what makes the sibling list load-bearing rather than decorative",
  );

  const prototypeOnly = [...SOURCE_STRINGS].find(
    (key) => key.length > 30 && !/[{{|]/.test(key) && !bodyStrings.has(key) && Object.prototype.hasOwnProperty.call(entries, key),
  );
  assert.ok(prototypeOnly, "there has to be a sentence only the prototype says, or nothing here is a real deletion");
  const problems = deadKeys(sourceProblems(renameKey(SOURCE, prototypeOnly, "Nothing anywhere says this any more"), BODIES));
  assert.deepEqual(
    problems,
    ['the dictionary holds "Nothing anywhere says this any more", which nothing in the Page source says — remove the key or find the string that lost it'],
    "deleting a sentence from the prototype, with no Body saying it, is caught by exactly one problem",
  );
});

/** Rename one dictionary key, leaving whatever pointed at its string behind. */
function renameKey(source, from, to) {
  const quoted = `"${from}"`;
  const at = source.indexOf(quoted);
  assert.notEqual(at, -1, `${quoted} is not in the prototype source`);
  assert.equal(source.indexOf(quoted, at + 1), -1, `${quoted} appears twice, so the mutation would miss one`);
  return source.slice(0, at) + `"${to}"` + source.slice(at + quoted.length);
}

const deadKeys = (problems) => problems.filter((problem) => problem.includes("nothing in the Page source says"));

// ── the chrome is shared by address (ADR 0004) ──────────────────────────────

test("the two variants link one stylesheet and their own behaviour file", () => {
  // ADR 0004 in one line: what is identical at every address is fetched once.
  // The hash is the contents, so "identical" is what makes it one file rather
  // than two with the same bytes, and a link to a name this build never wrote
  // is a 404 no page would ever show.
  const { files } = generate();
  const sheets = [...files.keys()].filter((name) => name.endsWith(".css"));
  const behaviours = [...files.keys()].filter((name) => name.endsWith(".js"));
  assert.equal(sheets.length, 1, `the CSS is identical at both addresses, so it must be one file: ${JSON.stringify(sheets)}`);
  assert.equal(behaviours.length, 2, "the sentences the form says are in the page's own language, so behaviour is one file per variant");

  const nl = variant("nl");
  const en = variant("en");
  assert.equal(nl.chrome.css, en.chrome.css, "the variants styled themselves differently, so the stylesheet is not shared after all");
  assert.notEqual(nl.chrome.js, en.chrome.js, "the behaviour files are byte-identical, so they were never split per language");

  // The links are read off what the build writes rather than off renderVariant,
  // because naming the chrome is the build's job: a rendered page holds a token
  // until linkChrome turns it into a path, and the token is not an address.
  for (const [lang, rendered] of [["nl", nl], ["en", en]]) {
    const page = files.get(distPath(home, lang));
    assert.ok(page, `no page was written for ${lang}`);
    for (const [kind, ext] of [["css", "css"], ["js", "js"]]) {
      const href = new RegExp(`(?:href|src)="(/assets/site\\.[0-9a-f]{12}\\.${ext})"`).exec(page)?.[1];
      assert.ok(href, `${urlOf("home", lang)} links no ${ext === "css" ? "stylesheet" : "behaviour file"}`);
      // An absolute path in the page, a dist-relative name in the build: the
      // leading slash is the difference between serving and writing.
      assert.ok(files.has(href.slice(1)), `${urlOf("home", lang)} links ${href}, which this build did not write`);
      assert.equal(files.get(href.slice(1)), rendered.chrome[kind], `${urlOf("home", lang)}: ${href} is not the chrome rendered for it`);
    }
  }
});

test("what is emitted carries no chrome of its own, and no token waiting for a name", () => {
  // R9's first half, and the reason a generated page opened from disk is
  // unstyled on purpose: the chrome sits beside the file, addressed absolutely,
  // because every address is meant to name the same two files.
  for (const lang of LANGS) {
    const { html } = variant(lang);
    assert.ok(!/<style[\s>]/.test(html), `${lang}: a <style> survived the split, so this page carries its own CSS`);
    assert.equal(
      inlineScripts(html).filter((code) => code.includes("addEventListener")).length,
      0,
      `${lang}: behaviour is still running from inside the document`,
    );
  }
  assert.ok(SOURCE.includes("<style>"), "the authored file keeps its CSS inline — U3 splits what is emitted, not what is written");
  for (const [name, bytes] of generate().files) {
    const token = Object.values(CHROME_TOKENS).find((candidate) => String(bytes).includes(candidate));
    assert.ok(!token, `${name} still holds ${token}, which a browser would ask for as a file and be answered with 404`);
  }
});

test("a split that would be wrong is refused rather than guessed at", () => {
  // Two shapes change what a visitor runs, quietly: a second behaviour block,
  // whose order becomes a question about which file the cache answered, and one
  // page's own CSS, which belongs in no file that is shared by address.
  const second = renderWith("nl", (source) => source.replace("</body>", "<script>var extra = 1;</script>\n</body>"));
  assert.ok(
    second.problems.some((problem) => problem.includes("the behaviour file is one file")),
    `expected a two-script refusal, got:\n  - ${second.problems.join("\n  - ")}`,
  );

  const ownCss = renderWith("nl", (source) => source.replace("</body>", "<style>.extra { color: red; }</style>\n</body>"));
  assert.ok(
    ownCss.problems.some((problem) => problem.includes("one page's own CSS")),
    `expected a body-style refusal, got:\n  - ${ownCss.problems.join("\n  - ")}`,
  );
});

test("a runtime that moved into the chrome instead of being deleted is still caught", () => {
  // R13 was measured on the document while the document was everything. Once
  // the behaviour became a file, that promise needs the file in scope too —
  // otherwise the language machinery survives in a cached asset no page names.
  const out = renderWith("nl", (source) => source.replace("  var S = {", "  var NL = {};\n  var S = {"));
  assert.ok(out.chrome.js.includes("var NL = {"), "and the runtime did land in the chrome, which is what this test is for");
  assert.ok(
    out.problems.some((problem) => problem.includes("page or chrome alike")),
    `expected the guard to read the chrome as well, got:\n  - ${out.problems.join("\n  - ")}`,
  );
});

// ── the four files that are not pages (R5, R6, R7, R9) ──────────────────────
//
// A crawler reads these before it reads a word of copy, and none of them is
// generated from a Page source, so nothing else in the suite covers them. The
// claims here are the four the unit was written for: robots.txt is the stance
// ADR 0007 chose and names no address of its own; the sitemap is the route
// table; the cache headers are true of the names the build chose; and the
// not-found page routes without asking to be indexed.

const ROBOT_SOURCE = read("src/robots.txt");
const BING_SOURCE = read("src/BingSiteAuth.xml");
const NOT_FOUND = read("src/404.nl.html");

const robotCase = (edit) => robotsFile(edit(ROBOT_SOURCE));
const refused = (out, phrase, label) =>
  assert.ok(
    out.problems.some((problem) => problem.includes(phrase)),
    `${label}: expected "${phrase}", got:\n  - ${out.problems.join("\n  - ")}`,
  );
const lines = (text) => text.split("\n");

test("robots.txt refuses training, welcomes retrieval, and states one address", () => {
  const { contents, problems } = robotsFile(ROBOT_SOURCE);
  assert.deepEqual(problems, [], "the authored robots.txt is on speaking terms with its own guards");

  // The one `Sitemap:` line is the build's, because it is the one URL in the
  // file that nobody can check by eye.
  assert.equal(lines(contents).filter((line) => /^Sitemap:/i.test(line)).length, 1);
  assert.ok(contents.includes(`Sitemap: ${company.origin}/sitemap.xml`), "the sitemap is where the register's host says it is");

  // Everything else is fetched. A `Disallow` here is a statement about fetching,
  // not about keeping, and the two are not interchangeable (ADR 0007).
  assert.ok(/^User-agent: \*\nAllow: \/$/m.test(contents), "every crawler may fetch the site");
  assert.equal(
    lines(contents).filter((line) => /^Disallow:\s*\/?docs/i.test(line)).length,
    0,
    "the diagrams are kept out of the index by a noindex, which only counts on a page that can be fetched",
  );

  for (const bot of ["GPTBot", "CCBot", "Google-Extended", "anthropic-ai", "Bytespider", "Diffbot", "FacebookBot"]) {
    assert.ok(lines(contents).includes(`User-agent: ${bot}`), `${bot} is neither refused nor welcomed, which is the default someone else chose`);
  }
  for (const bot of ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Applebot", "GoogleOther"]) {
    const at = contents.indexOf(`User-agent: ${bot}`);
    assert.ok(at !== -1, `${bot} is unnamed, and a crawler that is not named inherits the * group`);
    assert.ok(/Allow: \//.test(contents.slice(at, contents.indexOf("\n\n", at) === -1 ? undefined : contents.indexOf("\n\n", at))), `${bot} is not welcomed in its own group`);
  }
  assert.ok(
    contents.indexOf("GoogleOther") > contents.indexOf("Disallow: /"),
    "GoogleOther sits after the refuse block, so the file reads as two answers rather than one list with an exception in it",
  );
});

test("the two edits that would undo ADR 0007 stop the build", () => {
  // Both are improvements: someone hides the diagrams, or writes the sitemap line
  // the file is supposed to gain. Each has to be a refusal rather than a smaller
  // site, because either one works for a month before it costs a page.
  refused(robotCase((text) => `${text}\nSitemap: https://www.datawego.nl/sitemap.xml\n`), "name the sitemap twice", "an authored Sitemap: line");
  refused(
    robotCase((text) => text.replace("User-agent: *\nAllow: /", "User-agent: *\nAllow: /\nDisallow: /docs")),
    "the trap ADR 0007 records",
    "the * group disallowing /docs",
  );
  refused(
    robotCase((text) => text.replace("User-agent: GPTBot", "User-agent: SemrushBot\nDisallow: /docs/\n\nUser-agent: GPTBot")),
    "the trap ADR 0007 records",
    "a named group disallowing /docs/",
  );
  refused(
    robotCase((text) => text.replace("User-agent: *\nAllow: /", "User-agent: *\nDisallow: /")),
    "the 119KB generated answer",
    "the * group disallowing everything",
  );

  // Consecutive `User-agent:` lines are one group (RFC 9309), which is what makes
  // the seven-line refuse block above a refusal for seven crawlers rather than
  // one. A parser that kept only the last would pass three of the four above and
  // fail this.
  const group = robotsFile("User-agent: FooBot\nUser-agent: *\nAllow: /\nDisallow: /docs/\n");
  refused(group, "the trap ADR 0007 records", "a rule that belongs to a group of two agents");
  refused(group, "the 119KB generated answer", "the same rule, read as the * group's");
});

test("BingSiteAuth.xml ships as Bing issued it, and a hand-edit stops the build", () => {
  // ⑤: the file is the verification. Nothing here is derived — the build's whole
  // job is to carry these bytes to a root a checker can fetch without JavaScript.
  const { contents, problems } = bingAuthFile(BING_SOURCE);
  assert.deepEqual(problems, [], "the issued file is on speaking terms with its own guard");
  assert.equal(contents, `${BING_SOURCE.trimEnd()}\n`, "the bytes are what Bing handed over, plus one line ending");
  assert.match(contents, /<user>[0-9A-F]{32}<\/user>/, "the key is 32 uppercase hex digits, which is what the checker compares");

  // The three edits someone would call an improvement: tidy the casing, annotate
  // the provenance, or import a second account's key beside ours. Each turns the
  // file into something the checker will not read as issued, and that failure is
  // silent for months, so it is loud here instead.
  refused(bingAuthFile(BING_SOURCE.toLowerCase()), "not the file Bing issues", "a lowercased key");
  refused(bingAuthFile(BING_SOURCE.replace("<users>", "<!-- from Bing -->\n<users>")), "not the file Bing issues", "a comment above the users");
  refused(
    bingAuthFile(BING_SOURCE.replace("</users>", "\t<user>0123456789ABCDEF0123456789ABCDEF</user>\n</users>")),
    "not the file Bing issues",
    "a second user, whose key would be someone else's claim on this site",
  );
});

test("sitemap.xml is the route table, and nothing else", () => {
  const { contents, problems } = sitemapXml();
  assert.deepEqual(problems, [], "a build with a live indexable route has a sitemap to write");
  assert.match(contents, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);

  const locs = [...contents.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locs, sitemapUrls(), "the sitemap and the route table are the same list, or they are two lists");
  assert.equal(locs.length, 10, "five surfaces, two variants (ADR 0002)");

  // R3/R4, in the shape this suite can check without a network: the two places
  // that name an address agree, and the third is the one that cannot be
  // generated wrong because it reads the second.
  for (const lang of LANGS) {
    const canonical = /rel="canonical" href="([^"]*)"/.exec(variant(lang).html)[1];
    assert.ok(locs.includes(canonical), `${urlOf("home", lang)}: the canonical names ${canonical}, which the sitemap does not list`);
  }
  for (const route of ROUTES) {
    if (route.indexable || route.status !== "live") continue;
    assert.ok(!contents.includes(urlOf(route.key, "nl")), `${route.key} is not an indexable surface (ADR 0002)`);
  }

  // A date this build cannot know is a date it should not print. R11 refuses an
  // invented `dateModified` in the graph for the same reason.
  assert.ok(!/<lastmod>/.test(contents), "the sitemap invented a modification date");
});

test("_headers caches the chrome by its name, and never claims a host", () => {
  const { contents } = headersFile();

  // ADR 0006, the trap: this file applies to a whole Pages project rather than
  // to one host, so the noindex that would "fix" the pages.dev copy noindexes
  // the canonical site with it.
  assert.ok(!/x-robots-tag/i.test(contents), "an X-Robots-Tag here is a noindex on every host the project answers on");

  const global = contents.indexOf("/*\n");
  const assets = contents.indexOf("/assets/*\n");
  assert.ok(global !== -1 && assets > global, "the chrome needs its own section, after the one every path matches");

  const immutable = contents.indexOf("Cache-Control: public, max-age=31536000, immutable");
  const detach = contents.indexOf("! Cache-Control");
  assert.ok(detach > assets && detach < immutable, "and it has to detach first: a header applied twice is joined with a comma, so the asset would arrive saying max-age=0 and max-age=31536000 in one value");

  assert.match(contents.slice(global, assets), /Cache-Control: public, max-age=0, must-revalidate/);
  assert.equal(lines(contents).filter((line) => /^Strict-Transport-Security:/.test(line.trim())).length, 1, "HSTS once, on /*, and not on the asset paths that inherit it");
  assert.match(contents, /X-Content-Type-Options: nosniff/);
});

test("the not-found page routes, and asks for nothing", () => {
  const { files } = generate();
  const shippedPage = files.get("404.html");
  assert.ok(shippedPage, "an unknown address would be answered with the homepage, which is the defect this unit is a fix for (R7)");

  // The page explains itself in a comment, so the claims about what it does not
  // carry are read off its markup. That is also how static.mjs guards it, which
  // is the pair worth keeping honest: if a reader and the build disagree about
  // what a comment is, one of them is checking the wrong bytes.
  const page = shippedPage.replace(/<!--[\s\S]*?-->/g, "");

  assert.match(page, /^<html lang="nl">/m);
  assert.match(page, /<title>DataWeGo — Pagina niet gevonden<\/title>/);
  assert.match(page, /<meta name="robots" content="noindex, follow" \/>/);

  // Soft 404 territory: a canonical to a page that exists tells Google this one
  // is the same document, and this one is not.
  assert.ok(!/rel="canonical"/.test(page), "a 404 that canonicalises the homepage is a soft 404");
  assert.ok(!/hreflang\s*=/.test(page), "an hreflang set belongs to a Page and its variants, not to a response");

  for (const lang of LANGS) {
    assert.ok(page.includes(urlOf("home", lang)), `${urlOf("home", lang)} is not offered as a way out`);
  }
  assert.ok(page.includes(`mailto:${company.email}`), "and the mail address is the register's, restated once by the build");
  assert.ok(!/datawego\.pages\.dev|https?:\/\/(?!www\.datawego\.nl)[a-z]/.test(page), "no address in it belongs to anything but the site");

  // One fetch of the shared stylesheet, the theme resolved before paint, and no
  // behaviour: the page must answer without running anything (ADR 0004).
  const href = /<link rel="stylesheet" href="([^"]*)" \/>/.exec(page)[1];
  assert.equal(href, `/${[...files.keys()].find((name) => name.endsWith(".css"))}`);
  assert.ok(files.has(href.slice(1)), `${href} is not the stylesheet this build wrote`);
  const boot = inlineScripts(page);
  assert.equal(boot.length, 1, "one script runs on the page behind a wrong address, and it is the theme");
  assert.equal(boot[0], themeBoot(variant("nl").html), "the theme boot is a copy of the home page's rather than the home page's");
  assert.ok(!/<script[^>]+\bsrc=/.test(page), "a behaviour file on this page is a fetch before an answer");
  assert.ok(!/localStorage\.getItem\("datawego-lang"\)|renderLang/.test(page), "the language runtime is nowhere in what a 404 sends (R13)");

  // And it never echoes: a page that repeats the requested path repeats whatever
  // arrives at it, into a page a crawler indexes and a header can be smuggled.
  assert.ok(!/location\.(pathname|href)|document\.URL|error_page/.test(page), "the 404 reads the address it was served for");
});

test("a not-found page that stopped sharing the chrome is refused", () => {
  // The two halves of the claim, both by the same mechanism: the css name and the
  // boot body are the build's to know, so a source that lost either would ship a
  // token, and a token is a request for a file called `{{CHROME_CSS}}`.
  const noCss = notFoundPage({ source: NOT_FOUND.replace(CHROME_TOKENS.css, "site.css"), cssHref: "/assets/site.000000000000.css", boot: "/* */" });
  refused(noCss, "stopped sharing the site's chrome", "a 404 with a hand-written stylesheet name");

  const noBoot = notFoundPage({ source: NOT_FOUND.replace(CHROME_TOKENS.boot, "/* nothing */"), cssHref: "/assets/site.000000000000.css", boot: "/* */" });
  refused(noBoot, "stopped sharing the site's chrome", "a 404 with the theme boot copied rather than filled");

  const unfilled = notFoundPage({ source: NOT_FOUND, cssHref: null, boot: null });
  refused(unfilled, CHROME_TOKENS.css, "a token nothing could fill, because no stylesheet was written");

  const canonical = notFoundPage({
    source: NOT_FOUND.replace(CHROME_TOKENS.css, `${CHROME_TOKENS.css}" />\n<link rel="canonical" href="https://www.datawego.nl/`),
    cssHref: "/assets/site.000000000000.css",
    boot: "/* */",
  });
  refused(canonical, "soft 404", "a 404 that canonicalises the homepage");
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

test("today's build is ten page documents, four diagrams, the chrome, the routing map, the images, and five files that are not pages", () => {
  const { files } = generate();
  const pages = [...files.keys()].filter((name) => name.endsWith("index.html")).sort();
  assert.deepEqual(
    pages,
    ROUTES.filter((r) => r.kind === "page" && r.status === "live").flatMap((r) => LANGS.map((lang) => distPath(r, lang))).sort(),
    "Stage 2 ships ten addresses, all of them the table's, and no more",
  );
  assert.equal(pages.length, 10, "five surfaces, two variants (ADR 0002)");
  assert.ok(files.has("_routes.json"), "without it the contact API stops being a Function");
  assert.match(files.get("_routes.json"), /"\/api\/\*"/);

  const diagrams = ROUTES.filter((route) => route.kind === "diagram");
  assert.equal(diagrams.length, 4);
  for (const route of diagrams) {
    const name = distPath(route, "nl");
    assert.ok(files.has(name), `${name} was not copied`);
    const served = String(files.get(name));
    const original = read(distPath(route, "nl"));   // the drawing keeps the file name; the address lost its extension (ADR 0005)

    // This is where R8 is kept: the two documents diverge inside <head> and
    // meet again for the rest of the file. A drawing that came back edited is
    // the build having opinions about someone else's output.
    assert.equal(
      served.slice(served.indexOf("</head>")),
      original.slice(original.indexOf("</head>")),
      `${name}: the body changed; the diagrams' drawings are out of scope (R8)`,
    );
    assert.equal(
      served.slice(0, served.indexOf("<head>")),
      original.slice(0, original.indexOf("<head>")),
      `${name}: even the tag before the head changed, which nothing here writes`,
    );
    assert.ok(served.length > original.length, `${name}: the head was replaced rather than added to`);
  }

  const chrome = [...files.keys()].filter((name) => /^assets\/site\./.test(name));
  assert.equal(chrome.length, 3, "one stylesheet shared by both addresses, one behaviour file each (ADR 0004)");
  for (const name of chrome) {
    assert.match(
      name,
      /^assets\/site\.[0-9a-f]{12}\.(css|js)$/,
      `${name} is not named after what it contains, so it cannot be cached forever (R9)`,
    );
  }

  // Artwork moves into `assets/` beside the chrome, because it earns the same
  // thing: a name that follows its bytes. `/assets/*` may then call itself
  // immutable without lying, and a replaced banner arrives as a new URL instead
  // of a stale one. What a person edits is still the name in `resources/`.
  const artwork = [...files.keys()].filter((name) => name.startsWith("assets/") && !chrome.includes(name));
  for (const name of artwork) {
    assert.match(
      name,
      /^assets\/[a-z0-9][a-z0-9._-]*\.[0-9a-f]{12}\.(webp|jpg|jpeg|png|svg)$/,
      `${name} is not named after what it contains, so it cannot be cached forever (R9)`,
    );
  }
  assert.deepEqual(
    artwork.map((name) => name.replace("assets/", "").replace(/\.[0-9a-f]{12}\./, ".")).sort(),
    ["apple-touch-icon.png", "favicon-32.png", "favicon.svg", "hero-1028.webp", "hero-1542.webp", "hero-2056.webp", "hero-640.webp", "logo.svg", "og-image.jpg"],
    "four hero widths, the mark, the favicon set, the social card — a different list is a different site",
  );
  assert.equal(
    [...files.keys()].filter((name) => name.startsWith("resources/")).length,
    0,
    "nothing under resources/ ships. It holds 15.7MB, six identical copies of the footer PNG among it, and a page asks for two files (R10)",
  );
  assert.ok(
    ![...files.keys()].some((name) => name.includes("DataWeGo_banner3")),
    "the banner the WebP files derive from is named once, in a comment, and a comment is not a request",
  );

  // The Definition of Done's "under a tenth", measured against the artwork that
  // is still on disk under the name the page carried before U5.
  const authored = (file) => fs.readFileSync(new URL(`../resources/${file}`, import.meta.url)).byteLength;
  const heroes = artwork.filter((n) => n.includes("hero-")).map((n) => Buffer.byteLength(files.get(n)));
  assert.ok(
    Math.max(...heroes) * 10 < authored("DataWeGo_banner3.png"),
    `the widest hero candidate is ${Math.max(...heroes)} B; a tenth of the PNG it replaced is ${Math.round(authored("DataWeGo_banner3.png") / 10)} B`,
  );
  assert.ok(
    Buffer.byteLength(files.get(artwork.find((n) => n.startsWith("assets/logo.")))) * 10 < authored("DataWeGo_Logo.png"),
    "the footer mark costs under a tenth of the PNG it replaced",
  );

  for (const name of ["robots.txt", "sitemap.xml", "_headers", "404.html", "BingSiteAuth.xml"]) {
    assert.ok(files.has(name), `${name} was not written, so a crawler reads whatever the host has in its place`);
    assert.ok(!name.endsWith(".html") || name === "404.html", `${name}: only the not-found page is HTML outside the address tree (R7)`);
  }
  assert.equal(
    files.size,
    32,
    "ten page documents, four diagrams, three chrome files, nine artwork files, the routing map and the five statics — the build wrote something else, and the count is where it shows",
  );
  for (const name of artwork) {
    const logical = name.replace(/\.[0-9a-f]{12}\./, ".").replace("assets/", "resources/");
    const onDisk = fs.readFileSync(new URL(`../${logical}`, import.meta.url));
    assert.ok(Buffer.from(files.get(name)).equals(onDisk), `${name} is not ${logical} as it sits on disk`);
  }
});

test("a route that goes live without copy stops the build rather than shipping a placeholder", () => {
  // R16: a page ships with its words or does not ship. `pageSourceFor` is the
  // gate, and it is loud on purpose — the quiet alternative is an empty Dutch
  // practice area arriving in a search result, which is worse than no page.
  assert.equal(pageSourceFor(home), PAGE_SOURCES.home);
  assert.equal(pageSourceFor({ key: "dataplatforms-nobody-wrote" }), null, "a route with no file is a guess waiting to be written");

  // Home is one whole document; the other four Pages are bodies, and each must
  // exist, be non-empty, and be the only thing that makes its route live.
  for (const route of ROUTES.filter((r) => r.kind === "page" && r.status === "live")) {
    const file = pageSourceFor(route);
    assert.ok(file, `${route.key}: declared live with no Page source (R16)`);
    const bytes = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(bytes.trim().length > 200, `${route.key}: its source is ${bytes.length} bytes, which is a placeholder wearing a filename`);
    if (route.key !== "home") {
      assert.ok(!/<html|<head|<footer|<main/.test(bytes), `${route.key}: a body carries document parts — that is the chrome's job (ADR 0004)`);
      assert.match(bytes, /\{\{PAGE_NAME\}\}/, `${route.key}: the body typed its own name instead of asking the table for it`);
    }
  }

  assert.deepEqual(ROUTES.filter((route) => route.status === "planned"), [], "every declared surface is live; a route left dark would be an orphan with a plan");
});

test("a rendered Page says nothing its sources did not write", () => {
  // The durable form of the guard U9 needed. U9 shipped the four surfaces with
  // no new prose at all — home's own sentences, lifted — and U10 gave each of
  // them copy of its own, so "already said by the home Page" stopped being the
  // rule and became a coincidence. What has to stay true is weaker and harder:
  // the generator may move, translate and place words, and may invent none. So
  // every visible string on a rendered Page is required to be in the home
  // document, or in that Page's own Body, or to be the one sentence the register
  // lends every indexable address (ADR 0012). A generator that grew a friendly
  // "Copyright" of its own would fail here rather than ship half-English Dutch.
  const authored = new Map(
    ROUTES.filter((route) => route.kind === "page" && route.status === "live").map((route) => {
      const file = pageSourceFor(route);
      const body = file === null ? SOURCE : read(file);
      return [route.key, new Set([...visibleStrings(SOURCE), ...visibleStrings(body)].map((record) => record.key))];
    }),
  );

  const { files } = generate();
  for (const [key, said] of authored) {
    const html = String(files.get(distPath(routeByKey.get(key), "en")));
    const invented = [
      ...new Set(
        visibleStrings(html)
          .map((record) => record.key)
          .filter((text) => /[a-z]/i.test(text) && !said.has(text) && text !== company.practiceClause.en),
      ),
    ];
    assert.deepEqual(invented, [], `${key}: copy neither the prototype nor this Page's Body ever wrote`);
  }
});

test("each Page is 400–700 words of prose in both of its variants (R16)", () => {
  // The budget the plan set for the four new surfaces, read off the served bytes
  // in both languages. Both variants are counted because a translation that runs
  // long is the same failure the English copy would be, and because a Page that
  // only holds up in one language tells the owner nothing about the other. What
  // counts as a word lives in src/site/wordcount.mjs, shared with the tool that
  // shows the owner the figures.
  const { files } = generate();
  for (const route of ROUTES.filter((r) => r.kind === "page" && r.status === "live" && r.key !== "home")) {
    for (const lang of LANGS) {
      const counted = visibleWords(String(files.get(distPath(route, lang))));
      assert.ok(
        counted >= 400 && counted <= 700,
        `${urlOf(route.key, lang)}: ${counted} visible words, and R16 set 400-700 for every new Page`,
      );
    }
  }
});

test("the company facts the head states are the register's", () => {
  // Nothing in a variant may state a company fact the register does not carry.
  assert.ok(variant("nl").html.includes(company.name));
  assert.match(variant("nl").html, new RegExp(`<meta property="og:site_name" content="${company.name}"`));
  // Decision A, taken 2026-10-23 and made by U3: the street left the footer,
  // and the two ledger entries naming its first lines and the dictionary key
  // translating its third left with it. What has to stay true is that the
  // address cannot come back on one side only. Re-add the footer line and it is
  // unledgered English in the Dutch variant; re-add an entry or the key and
  // sourceProblems refuses a string the source no longer shows.
  const street = ["Spieringdam 1", "2492 ND Den Haag", "The Netherlands"];
  assert.deepEqual(street.filter((line) => SOURCE_STRINGS.has(line)), [], "the footer states the city, not the street");
  assert.deepEqual(
    street.filter((line) => isLedgered(line) || Object.hasOwn(entries, line)),
    [],
    "the ledger and the dictionary gave up the address when the page did (one change)",
  );
  assert.ok(!SOURCE.includes("Spieringdam"), "nor does the authored file keep it as a second copy of anything");
  assert.equal(company.streetAddress, null, "and the register never had it (ADR 0011's second amendment)");
  assert.ok(variant("nl").html.includes("Den Haag"), "the city is still stated, in Dutch, at the Dutch address");
});

// ── the words every Page shares, wherever they come from ────────────────────

test("the sole-practice clause is on every indexable Page exactly once, and on no Diagram at all (R12)", () => {
  // ADR 0012: the sentence is a claim about the company, not page copy, so the
  // generator places it and no body may write it. Placed twice it argues with
  // itself; placed never, the site says what it does not do. Both parse as HTML.
  const { files } = generate();
  const slot = /data-od-id="practice-clause">([^<]*)</g;

  for (const route of indexablePageRoutes) {
    for (const lang of LANGS) {
      const html = String(files.get(distPath(route, lang)));
      const placed = [...html.matchAll(slot)];
      assert.equal(placed.length, 1, `${urlOf(route.key, lang)}: ${placed.length} clauses, and the register says one thing about the company`);
      assert.equal(
        decodeEntities(norm(placed[0][1])),
        company.practiceClause[lang],
        `${urlOf(route.key, lang)}: the clause is not the register's sentence, in this language`,
      );
    }
  }

  for (const route of ROUTES.filter((r) => r.kind === "diagram")) {
    const html = String(files.get(distPath(route, "nl")));
    assert.ok(!html.includes("practice-clause"), `${route.key}: an evidence page borrows a claim about the firm it is not standing for`);
  }
  assert.ok(!String(files.get("404.html")).includes("practice-clause"), "the page that is nobody's answer says what the company is anyway");
});

test("a Page's name is the route table's, and its Dutch is the dictionary's", () => {
  // `navigation()` and `fillPageName` write the English name into the chrome and
  // let the Dutch pass turn it, because a name stated in two files is a name
  // that can be wrong in only one of them. So the table's Dutch name and the
  // dictionary's answer for the English one have to be the same word, including
  // when there is no answer, which is what a brand name is.
  for (const route of ROUTES.filter(isVariantBearing)) {
    const said = lookup(null, route.name.en);
    assert.equal(
      said ?? route.name.en,
      route.name.nl,
      `${route.key}: the table calls this Page one thing in Dutch and the dictionary another`,
    );
  }
});
test("the hero is asked for in widths, and the browser is the one that chooses", () => {
  const { files } = generate();
  const tag = /<img\b[^>]*\/>[\s\S]{0,40}?figcaption/.exec(String(files.get("index.html")));
  assert.ok(tag, "the hero image is no longer where the banner figure begins");
  const hero = tag[0];

  assert.match(hero, /\bfetchpriority="high"/, "the largest paint on the page asks to be fetched first (R10)");
  assert.match(hero, /\bsizes="100vw"/, "the banner is full-bleed, so the widths are worth a viewport (R10)");
  assert.match(hero, /\bloading="eager"/, "a lazy hero is a hero that arrives late");
  assert.match(hero, /\bwidth="2056" height="491"/, "no dimensions means the layout jumps when it lands (R10)");

  // Measured on what the browser is handed, after the build renamed every file
  // to its bytes: the descriptor has to be the width actually encoded, or a
  // candidate is picked for a resolution it cannot deliver.
  // Rooted, on purpose: a srcset entry is resolved against the page, and the
// English variant is not at the root (ADR 0005's second amendment).
const candidates = [...hero.matchAll(/\/assets\/hero-(\d+)\.[0-9a-f]{12}\.webp (\d+)w/g)];
  assert.deepEqual(candidates.map((m) => Number(m[2])), [640, 1028, 1542, 2056], "the srcset's declared widths");
  assert.deepEqual(candidates.map((m) => Number(m[1])), [640, 1028, 1542, 2056], "each candidate is named for its own pixels, and each was written to dist/");
  const fallback = /src="\/assets\/hero-(\d+)\.[0-9a-f]{12}\.webp"/.exec(hero);
  assert.ok(fallback, "the src is not one of the candidates");
  assert.ok(candidates.map((m) => m[1]).includes(fallback[1]), "the fallback has to be a candidate the browser would also accept");
});

test("an artwork reference is a request, and a mention is not", () => {
  // The bug this pins: the page's own comment names the 1.4MB PNG the hero WebP
  // files were derived from, in order to be honest about where they came from.
  // Prose that can put a file on the network is a file list nobody can read.
  const files = new Map([
    ["index.html", '<!-- derived from resources/DataWeGo_banner3.png --><img src="resources/logo.svg" />'],
  ]);
  const problems = [];
  shipAssets(files, problems);

  assert.deepEqual(problems, [], "a name in a comment is not a missing-file problem");
  assert.ok(
    ![...files.keys()].some((name) => name.includes("banner3")),
    "the commented-out provenance shipped the PNG anyway",
  );
  assert.ok(
    files.get("index.html").includes("<!-- derived from resources/DataWeGo_banner3.png -->"),
    "the rewrite moved the prose as well as the request, which is how the honesty gets lost",
  );
  assert.match(
    files.get("index.html"),
    /src="\/assets\/logo\.[0-9a-f]{12}\.svg"/,
    "the request was not rewritten to its content name, rooted so that it means the same file from /en/ as from /",
  );
});

test("artwork a page asks for that is not in the repository stops the build", () => {
  // tools/derive-images.py is run by hand, which makes it forgettable. A page
  // naming a hero width that was never encoded is the failure worth refusing.
  const files = new Map([["index.html", '<img src="resources/hero-9999.webp" />']]);
  const problems = [];
  shipAssets(files, problems);
  assert.equal(
    problems.filter((p) => p.includes("resources/hero-9999.webp")).length,
    1,
    "a request for artwork that does not exist has to be a failed build, not a broken image",
  );
  assert.match(problems.join("\n"), /derive-images\.py/, "and it has to say where the artwork comes from");
});

/* ------------------------------------------------------------- U6 — the four
 * Diagram pages: the only documents in this build whose body the repository
 * does not own. They are served, they are linked, and they ask not to be
 * indexed (ADR 0002, R8).
 */

test("a Diagram page says it is not for the index, and says what it shows (R8)", () => {
  const { files } = generate();
  const live = ROUTES.filter((route) => route.kind === "diagram" && route.status === "live");
  assert.equal(live.length, 4, "ADR 0002 counts four pieces of evidence");

  const sitemap = sitemapXml().contents;
  for (const route of live) {
    const name = distPath(route, "nl");
    const html = String(files.get(name));
    const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
    const copy = DIAGRAM_HEAD[route.key];

    assert.ok(head.includes(`<title>${copy.title}</title>`), `${name} is not titled by this repository (R8)`);
    assert.ok(
      head.includes(`<meta name="description" content="${copy.description}" />`),
      `${name} has no description, so whatever quotes it chooses its own sentence`,
    );
    assert.equal(
      (head.match(/name="robots"/g) || []).length,
      1,
      `${name} answers the robots question twice and leaves the crawler to pick`,
    );
    assert.ok(
      head.includes('<meta name="robots" content="noindex, follow" />'),
      `${name} is not asked out of the index, or is asked out and not followed (ADR 0002)`,
    );
    assert.match(
      head,
      /rel="icon"[^>]*href="\/assets\/favicon\.[0-9a-f]{12}\.svg"/,
      `${name} is an evidence page that opens in a tab with nothing in it`,
    );

    // The three tags whose whole job is to tell a ranker about an address. This
    // page has one address, no second language, and is asked not to be ranked:
    // Google's own guidance is that a canonical and a noindex never go together,
    // because they are two answers to the same question.
    assert.ok(!head.includes('rel="canonical"'), `${name} pairs a canonical with a noindex`);
    assert.ok(!head.includes("hreflang"), `${name} claims a second language a Diagram page does not have (ADR 0002)`);
    assert.ok(!sitemap.includes("docs/"), `${name} is announced in the sitemap, which un-hides what ADR 0002 hid`);
  }
});

test("the Diagram copy is one table, and it starts from the names the route table already gives", () => {
  const live = ROUTES.filter((route) => route.kind === "diagram" && route.status === "live").map((route) => route.key);
  assert.deepEqual(
    Object.keys(DIAGRAM_HEAD).sort(),
    live.slice().sort(),
    "diagrams.mjs and the route table disagree about which pages are evidence, and one of them is lying",
  );

  for (const [key, copy] of Object.entries(DIAGRAM_HEAD)) {
    const name = routeByKey.get(key).name.nl;
    assert.ok(
      copy.title.startsWith(`${name} — `),
      `${key}: its title does not open with the name the route table gives it, so the two will drift apart`,
    );
    assert.ok(copy.title.length <= 60, `${key}: ${copy.title.length} characters of title, and a result shows around 60`);
    assert.ok(
      copy.description.length >= 70 && copy.description.length <= 160,
      `${key}: ${copy.description.length} characters of description — long enough to say something, short enough not to be cut mid-word`,
    );
    assert.ok(!/u\b|\bu\./.test(copy.description), `${key}: the site says "je" (ADR 0012)`);
  }
});

test("a drawing whose head disagrees with the generator stops the build", () => {
  const route = routeByKey.get("diagram-pharm-platform");
  const source = read("docs/pharm-platform.html");

  const once = applyDiagramHead(source, route);
  assert.deepEqual(once.problems, [], "the committed diagram page is not the head this function reads");
  assert.notEqual(once.html, source, "nothing was written");

  // Applying it twice is what a re-exported file with a head already in it looks
  // like, and it is the cheapest way to prove the double-answer guard bites.
  const twice = applyDiagramHead(once.html, route);
  assert.equal(twice.problems.length, 2, "the same head written over itself is a page that answers robots and description twice");
  assert.match(twice.problems.join("\n"), /robots/);
  assert.match(twice.problems.join("\n"), /description/);
  assert.equal(twice.html, once.html, "a page the build refused was rewritten anyway");

  const stripped = source.replace(/<title>[\s\S]*?<\/title>/, "");
  const noTitle = applyDiagramHead(stripped, route);
  assert.equal(noTitle.problems.length, 1, "an exporter that stopped writing titles would ship a page with none");
  assert.equal(noTitle.html, stripped, "a page the build refused got a head anyway");

  const canonical = source.replace(/<\/title>/, `</title>\n  <link rel="canonical" href="https://www.datawego.nl/docs/pharm-platform" />`);
  assert.match(
    applyDiagramHead(canonical, route).problems.join("\n"),
    /canonical/,
    "a canonical smuggled into the drawing is the contradiction the test above checks every page for",
  );

  const unlisted = applyDiagramHead(source, { key: "diagram-someone-forgot", indexable: false });
  assert.equal(unlisted.problems.length, 1, "a Diagram route with no entry ships the exporter's title, quietly");
  assert.match(unlisted.problems.join("\n"), /declares no head/);
});

/* ------------------------------------------------------------------ what a
 * page asks for. Every one of these was invisible to the assertions above: a
 * build can write the right file at the right address and still hand the reader
 * a request that resolves somewhere else. Relative paths do that — they are
 * correct next to the file they were written in and wrong everywhere else, and
 * `x-default` is the "elsewhere" that matters, because it is the address Google
 * picks when it has no better idea (ADR 0005).
 */

/** The requests a browser would actually make, from the markup alone. */
function documentRequests(html) {
  const found = [];
  for (const match of html.matchAll(/\b(?:src|href|poster)="([^"]*)"|\bsrcset="([^"]*)"/g)) {
    if (match[1] !== undefined) found.push(match[1]);
    else found.push(...match[2].split(",").map((part) => part.trim().split(/\s+/)[0]));
  }
  return found.filter((request) => request && !/^(?:#|mailto:|tel:|data:|javascript:)/.test(request));
}

test("every file a page asks for is a file this build wrote, from that page's own address", () => {
  const { files } = generate();
  const written = new Set(files.keys());
  // An address and the bytes it answers with, for the fragment check below. A
  // Diagram is one address for both languages, and it is the drawing's own file,
  // whose ids belong to archify rather than to this build.
  const pages = new Map();
  for (const route of ROUTES.filter((entry) => entry.status === "live")) {
    for (const lang of isVariantBearing(route) ? LANGS : [ROOT_LANG]) {
      pages.set(urlOf(route.key, lang), String(files.get(distPath(route, lang))));
    }
  }
  const addresses = new Set(pages.keys());
  const origin = new URL(`${company.origin}`).origin;

  for (const [address, html] of pages) {
    for (const request of documentRequests(html)) {
      const url = new URL(request, address);
      // A script on someone else's host is not this build's to write, and a
      // link out of the site is not either.
      if (url.origin !== origin) continue;
      const fragment = url.hash.slice(1);
      url.hash = "";
      if (fragment) {
        const target = pages.get(url.href);
        assert.ok(
          target !== undefined,
          `${address} links to ${request}, an address this build writes no page for`,
        );
        assert.ok(
          new RegExp(`id="${fragment}"`).test(target),
          `${address} links to ${request}, and the page at that address holds no section named ${fragment} — a browser scrolls nowhere and reports nothing`,
        );
        continue;
      }
      const name = decodeURIComponent(url.pathname).replace(/^\//, "");
      // The three ways Pages turns a path into a file, which are the three
      // ways this build writes one: the name itself for anything in assets/,
      // `index.html` inside a directory for a Page, and `<name>.html` for a
      // Diagram, whose address lost its extension and whose file kept it.
      const answerable =
        written.has(name) || written.has(`${name.replace(/\/$/, "")}/index.html`) || written.has(`${name}.html`);
      assert.ok(
        addresses.has(url.href) || answerable,
        `${address} asks for ${request}, which resolves to ${url.href}: no file this build writes answers there (ADR 0005)`,
      );
    }
  }
  });

test("the not-found page asks for nothing relative, because it answers at an address it cannot know", () => {
  const { files } = generate();
  const html = String(files.get("404.html"));
  for (const request of documentRequests(html)) {
    assert.match(
      request,
      /^(?:\/|https?:)/,
      `404.html asks for ${request}, which resolves against whatever path the visitor mistyped rather than against the site`,
    );
  }
});

test("a Diagram link names the address Pages answers, in both variants (R8)", () => {
  const diagrams = ROUTES.filter((route) => route.kind === "diagram" && route.status === "live");
  assert.equal(diagrams.length, 4, "ADR 0002 counts four pieces of evidence");

  for (const lang of LANGS) {
    const html = variant(lang).html;
    for (const route of diagrams) {
      assert.ok(
        html.includes(`href="${urlOf(route.key, lang)}"`),
        `the ${lang} variant does not link ${route.key} at the address it answers at`,
      );
    }
    assert.ok(
      !/href="docs\//.test(html),
      `the ${lang} variant links a Diagram by a path relative to itself, which is /en/docs/ half the time`,
    );
    assert.deepEqual(leakedRouteLinks(html), [], `${lang}: a link token reached the document a browser reads`);
  }
});

test("a link naming no route stops the build instead of shipping a link to nowhere", () => {
  const stray = renderWith("nl", (source) =>
    source.replace(routeLinkToken("diagram-pharm-platform"), routeLinkToken("diagram-nobody-declared")),
  );
  assert.match(
    stray.problems.join("\n"),
    /diagram-nobody-declared/,
    "a typo in a link key is the same class of mistake as a typo in a route, and it deserves the same answer",
  );
});

test("no token of any kind survives into a file the browser is sent", () => {
  const { files } = generate();
  for (const [name, bytes] of files) {
    const text = String(bytes);
    for (const token of Object.values(CHROME_TOKENS)) {
      assert.ok(!text.includes(token), `${name} still holds ${token}`);
    }
    assert.deepEqual(leakedRouteLinks(text), [], `${name} still holds a link token`);
  }
});
