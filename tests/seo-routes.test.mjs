/**
 * Guard tests for the route table and the facts module (U1).
 *
 * These two files are what every address in the site is derived from, so most
 * of these tests are negative: each one shows that a specific mistake is
 * refused rather than shipped. Dependency-free on purpose — plain `node --test`
 * from the repository root, no build step, no fixture directory.
 *
 * The last group is the drift guard. With no Google Business Profile (ADR 0009)
 * the register and the page are one claim stated in two places, so a register
 * that stops matching the live Page has to fail here rather than in a search
 * result six months from now.
 */

import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import { company } from "../src/site/company.mjs";
import {
  LANGS,
  ROUTES,
  ROOT_LANG,
  X_DEFAULT_LANG,
  alternateLinks,
  assertRoutes,
  breadcrumbs,
  indexablePageRoutes,
  isVariantBearing,
  liveUrls,
  routeByKey,
  routeProblems,
  sitemapUrls,
  urlOf,
} from "../src/site/routes.mjs";
import { navigation } from "../src/site/chrome.mjs";

const PAGE_SOURCE = new URL("../datawego-company-site.html", import.meta.url);
const pageHtml = () => readFileSync(PAGE_SOURCE, "utf8");

/** The table with one route patched, for the cases the validator must refuse. */
function routesWith(key, patch) {
  return ROUTES.map((route) =>
    route.key === key
      ? { ...route, ...patch, path: { ...route.path, ...(patch.path || {}) } }
      : route,
  );
}

function problemFor(key, patch, fragment) {
  const problems = routeProblems(routesWith(key, patch));
  assert.ok(
    problems.some((problem) => problem.includes(fragment)),
    `expected a problem naming "${fragment}", got:\n  - ${problems.join("\n  - ")}`,
  );
}

// ── the table as it stands ──────────────────────────────────────────────────

test("the route table is valid, and the validator is not merely decorative", () => {
  assert.equal(assertRoutes(), true);
  assert.deepEqual(routeProblems(), []);
});

test("exactly five surfaces are indexable, and every one is a Page", () => {
  assert.equal(indexablePageRoutes.length, 5);
  for (const route of indexablePageRoutes) {
    assert.equal(route.kind, "page", `${route.key}: indexable but not a Page`);
    assert.equal(route.indexable, true);
  }
  // Case studies stayed Sections, so no route was invented for them (ADR 0002).
  assert.equal(ROUTES.filter((route) => route.kind === "page").length, 5);
});

test("Dutch owns the root and English owns /en/ (ADR 0001)", () => {
  assert.equal(ROOT_LANG, "nl");
  assert.equal(X_DEFAULT_LANG, "en");
  assert.deepEqual(LANGS, ["nl", "en"]);

  const home = routeByKey.get("home");
  assert.equal(home.path.nl, "/");
  assert.equal(home.path.en, "/en/");

  for (const route of ROUTES) {
    if (!isVariantBearing(route)) continue;
    assert.ok(!route.path.nl.startsWith("/en/"), `${route.key}: Dutch address under /en/`);
    if (route.key !== "home") {
      assert.ok(route.path.en.startsWith("/en/"), `${route.key}: English address outside /en/`);
    }
  }
});

test("every address is absolute and on the one host that answers (ADR 0006)", () => {
  for (const route of ROUTES) {
    for (const lang of LANGS) {
      const url = urlOf(route.key, lang);
      assert.ok(url.startsWith(`${company.origin}/`), `${route.key}.${lang} left the canonical host: ${url}`);
      assert.ok(!/[?#]/.test(url), `${route.key}.${lang} carries a query or fragment: ${url}`);
      assert.ok(!/%/.test(url), `${route.key}.${lang} is not a clean path: ${url}`);
    }
  }
});

test("no address carries a file extension, and only a Page address carries a slash (ADR 0005)", () => {
  for (const route of ROUTES) {
    for (const lang of LANGS) {
      assert.ok(!route.path[lang].endsWith(".html"), `${route.key}.${lang}: an extension is a file, not an address`);
    }
    if (route.form === "directory") {
      assert.ok(route.path.nl.endsWith("/"), `${route.key}.nl needs a trailing slash`);
      assert.ok(route.path.en.endsWith("/"), `${route.key}.en needs a trailing slash`);
    } else {
      assert.equal(route.form, "asset", `${route.key}: an undeclared third form`);
      assert.ok(!route.path.nl.endsWith("/"), `${route.key}: an asset address has no trailing slash`);
    }
  }
});

// ── what is real today, versus what is merely declared ──────────────────────

test("the sitemap lists live indexable variants only: ten rows after Stage 2 (R6)", () => {
  // Written out rather than derived, so the test can disagree with the table.
  assert.deepEqual(sitemapUrls(), [
    "https://www.datawego.nl/",
    "https://www.datawego.nl/en/",
    "https://www.datawego.nl/dataplatforms/",
    "https://www.datawego.nl/en/data-platforms/",
    "https://www.datawego.nl/ai-oplossingen/",
    "https://www.datawego.nl/en/ai-solutions/",
    "https://www.datawego.nl/cloud-en-enterprise-software/",
    "https://www.datawego.nl/en/cloud-and-enterprise-software/",
    "https://www.datawego.nl/zorg-en-life-sciences/",
    "https://www.datawego.nl/en/healthcare-life-sciences/",
  ]);
});

test("nothing is declared in the dark, and no live Page is out of reach (R6)", () => {
  // Stage 1's guard was that a planned route leaks into nothing. Stage 2 took
  // those four Pages live, so the same muscle now points the other way, and the
  // failure it is looking for has changed shape: not a half-emitted mirror, but
  // a page that exists, says it exists, and can be reached from nowhere.
  assert.deepEqual(
    ROUTES.filter((route) => route.status === "planned"),
    [],
    "a dark route is now a decision not to ship something, and the table does not say that",
  );

  const shipped = new Set([...liveUrls("nl"), ...liveUrls("en"), ...sitemapUrls()]);
  for (const route of ROUTES) {
    for (const lang of LANGS) {
      assert.ok(shipped.has(urlOf(route.key, lang)), `${route.key}.${lang} is declared and shipped nowhere`);
    }
  }

  // An hreflang set naming an address that 404s is worse than no hreflang.
  for (const route of ROUTES.filter((r) => r.status === "live" && isVariantBearing(r))) {
    for (const link of alternateLinks(route.key)) {
      assert.ok(shipped.has(link.href), `${route.key}: alternate ${link.lang} points at a dark route`);
    }
  }

  // Reach. The navigation is the one set of links every Page carries, so a live
  // Page the navigation does not name is an address a crawler reaches only if it
  // guesses it - which is what a sitemap row is for, and not what a site is for.
  const nav = navigation();
  for (const route of ROUTES.filter((r) => r.kind === "page" && r.status === "live" && r.key !== "home")) {
    assert.ok(nav.includes(`{{LINK:${route.key}}}`), `${route.key}: indexable, and named by no navigation`);
  }
});

test("every live Page ships both variants, because half a mirror is an invalid hreflang set", () => {
  for (const route of ROUTES.filter((r) => r.status === "live" && isVariantBearing(r))) {
    for (const lang of LANGS) assert.ok(route.path[lang], `${route.key}: live with no ${lang} address`);
  }
});

test("hreflang is complete for Pages and absent for Diagram pages (ADR 0002)", () => {
  for (const route of ROUTES.filter(isVariantBearing)) {
    const links = alternateLinks(route.key);
    assert.deepEqual(links.map((link) => link.lang), ["nl", "en", "x-default"]);
    const byLang = new Map(links.map((link) => [link.lang, link.href]));
    assert.equal(byLang.get("nl"), urlOf(route.key, "nl"));
    assert.equal(byLang.get("en"), urlOf(route.key, "en"));
    assert.equal(byLang.get("x-default"), byLang.get("en"), "x-default must fall back to English");
    assert.equal(new Set(links.map((link) => link.href)).size, 2, "three labels, two addresses");
  }
  for (const route of ROUTES.filter((r) => !isVariantBearing(r))) {
    assert.deepEqual(alternateLinks(route.key), [], `${route.key}: a Diagram page has no variants`);
    assert.equal(urlOf(route.key, "nl"), urlOf(route.key, "en"), `${route.key}: one address`);
    assert.equal(route.indexable, false);
  }
});

test("the breadcrumb root is the company, not the word Home", () => {
  // The Page never writes "Home": no nav item, no dictionary key. If that
  // changes, this assertion is the prompt to revisit what the root crumb says.
  assert.ok(!/\bHome\b/.test(pageHtml()), 'the Page now uses the word "Home"; revisit the root crumb');

  for (const lang of LANGS) {
    const trail = breadcrumbs("home", lang);
    assert.equal(trail.length, 1);
    assert.equal(trail[0].name, company.name);
    assert.equal(trail[0].href, urlOf("home", lang));
    assert.ok(!/home/i.test(trail[0].name), "the root crumb is a brand name, not a label");
  }

  assert.equal(breadcrumbs("diagram-pharm-platform", "nl").length, 1, "a single-address route is not a step in a trail");
});

// ── the validator refuses each mistake ──────────────────────────────────────

test("refuses two routes claiming one address", () => {
  problemFor("dataplatforms", { path: { nl: "/", en: "/en/" } }, "duplicate address");
});

test("refuses a bare address where Pages answers with a trailing slash", () => {
  // The reference project's defect: canonical and sitemap name /x while Pages
  // 308s /x -> /x/.
  problemFor("ai-oplossingen", { path: { nl: "/ai-oplossingen" } }, "trailing slash");
});

test("refuses an English address outside /en/ and a Dutch one inside it", () => {
  problemFor("cloud-en-enterprise-software", { path: { en: "/cloud-and-enterprise-software/" } }, "lives under /en/");
  problemFor("zorg-en-life-sciences", { path: { nl: "/en/zorg-en-life-sciences/" } }, "cannot live under /en/");
});

test("refuses a Diagram page marked indexable, and a Page shipped but not indexable", () => {
  problemFor("diagram-ehr-etl-pipeline", { indexable: true }, "never an indexable surface");
  problemFor("zorg-en-life-sciences", { indexable: false }, "either indexable or it is not shipped");
});

test("refuses a single-address route that declares two addresses", () => {
  problemFor("diagram-marketing-research-swarm", { path: { en: "/docs/swarm" } }, "declares two paths");
  problemFor("diagram-pharm-platform", { path: { nl: "/docs/pharm-platform.html", en: "/docs/pharm-platform.html" } }, "names a file rather than the address");
});

test("refuses an address carrying a query or a fragment", () => {
  problemFor("dataplatforms", { path: { nl: "/dataplatforms/?hl=nl" } }, "query or fragment");
});

test("refuses a home that stops being the Dutch root", () => {
  problemFor("home", { path: { nl: "/nl/" } }, "root address belongs to Dutch");
  problemFor("home", { path: { en: "/" } }, "English home is /en/");
});

test("refuses a live Page with only one variant", () => {
  problemFor("cloud-en-enterprise-software", { status: "live", path: { en: "" } }, "half a mirror");
});

test("refuses any number of indexable surfaces but the five that were decided", () => {
  const four = routesWith("zorg-en-life-sciences", { indexable: false });
  const six = routesWith("diagram-ehr-etl-pipeline", {
    kind: "page",
    form: "directory",
    indexable: true,
    path: { nl: "/etl/", en: "/en/etl/" },
  });
  for (const [candidate, count] of [
    [four, 4],
    [six, 6],
  ]) {
    assert.ok(
      routeProblems(candidate).some((problem) => problem.includes(`${count} indexable surfaces`)),
      `a table with ${count} indexable surfaces must fail the build`,
    );
  }
});

// ── the facts module versus the live Page ───────────────────────────────────

test("the register states each company fact once, and the Page says the same thing", () => {
  const html = pageHtml();
  const stated = [
    [company.name, "the company name"],
    [company.kvk, "the KvK number"],
    [company.email, "the contact address"],
    [company.linkedin, "the LinkedIn profile"],
    [company.locality, "the locality"],
    [company.origin, "the canonical host"],
  ];
  for (const [value, label] of stated) {
    assert.ok(value, `the register lost ${label}`);
    assert.ok(html.includes(value), `${label} is in the register but not on the Page: ${value}`);
  }
  // The footer is the mechanism behind ADR 0009, so the numbers sit in one region.
  const footer = html.slice(html.lastIndexOf("<footer"));
  assert.ok(footer.includes(company.kvk), "the KvK number left the footer");
  assert.ok(footer.includes(company.email), "the email left the footer");
});

test("the eenmanszaak stays a fact about the register rather than a rendered claim", () => {
  assert.equal(company.legalForm, "eenmanszaak");
  assert.equal(company.renderLegalForm, false, "ADR 0011 amendment: nothing may imply limited liability");
  assert.equal(company.legalName, null, "ADR 0008: the site names nobody");
  assert.equal(company.streetAddress, null, "the graph stays at city level (ADR 0009, ADR 0011)");
  assert.equal(company.postalCode, null);
  assert.equal(company.phone, null, "a number Google can call is a Profile in disguise (ADR 0009)");
});

test("the graph is given no author to name (ADR 0008)", () => {
  assert.deepEqual(company.authors, [], "a Person node would contradict the decision to stay anonymous");
});

test("the sole-practice clause exists in both variants and names who is speaking (ADR 0012)", () => {
  assert.deepEqual(Object.keys(company.practiceClause).sort(), ["en", "nl"]);
  const { nl, en } = company.practiceClause;
  for (const [text, lang] of [
    [nl, "nl"],
    [en, "en"],
  ]) {
    assert.ok(text.startsWith(company.name), `${lang}: the clause must state who is speaking`);
    assert.ok(/[.!]$/.test(text), `${lang}: the clause is a sentence`);
  }
  assert.match(nl, /\bonafhankelijke data- en AI-adviseur\b/);
  assert.match(en, /\bindependent data and AI adviser\b/);
});
