/**
 * Guard tests for the structured data (U7, ADR 0011, R11).
 *
 * A graph is the part of a site that answers without being asked, so the
 * interesting assertions here are the negative ones: the fields ADR 0011 decided
 * not to state, and the two precisions the firm has no business claiming, have to
 * be *absent* rather than empty. `"telephone": null` is a sentence — "this company
 * has no telephone" — and so is a `PostalAddress` with a street in it, on a site
 * that declined the instrument that would check it (ADR 0009).
 *
 * The positive ones all go back to one module. Where a test could compare an
 * emitted value against a literal, it compares against `company` or the route
 * table instead, because the failure this file is allowed to prevent is not "the
 * value is wrong" but "the value is right here and wrong there".
 *
 * Nothing here reads `dist/`, and nothing here trusts the page: every document
 * is parsed out of what `generate()` wrote.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { generate, distPath } from "../build.mjs";
import { company } from "../src/site/company.mjs";
import { LANGS, ROUTES, breadcrumbs, routeByKey, urlOf } from "../src/site/routes.mjs";
import { breadcrumbNode, organizationNode, pageGraph, serviceNode, webSiteNode } from "../src/site/graph.mjs";

const home = routeByKey.get("home");
const livePages = ROUTES.filter((route) => route.kind === "page" && route.status === "live");
const diagrams = ROUTES.filter((route) => route.kind === "diagram" && route.status === "live");

const SCRIPT = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

/** Every graph a built document carries, keyed by its file name. */
function built() {
  const { files, problems } = generate();
  assert.deepEqual(problems, [], "the build the graph is shipped by does not pass");
  const graphs = new Map();
  for (const [name, contents] of files) {
    if (!name.endsWith(".html")) continue;
    graphs.set(name, graphsIn(contents));
  }
  return { files, graphs };
}

/** The graphs one built document carries, parsed the way a crawler's would. */
function graphsIn(html) {
  return [...String(html).matchAll(SCRIPT)].map((m) => JSON.parse(m[1]));
}

/** The @graph of the single document-level graph, for tests that want nodes. */
function nodesIn(html) {
  const [graph] = graphsIn(html);
  return graph["@graph"];
}

/** The address of the page a graph was found on, for a failure worth reading. */
const at = (key, lang) => urlOf(key, lang);

test("a Page address carries one graph, and it parses without JavaScript", () => {
  const { graphs } = built();
  for (const route of livePages) {
    for (const lang of LANGS) {
      const name = distPath(route, lang);
      const blocks = graphs.get(name);
      assert.equal(blocks.length, 1, `${name}: ${blocks.length} graphs, and a crawler merges them however it likes`);
      const [graph] = blocks;
      assert.equal(graph["@context"], "https://schema.org", `${name}: a graph without its vocabulary is a blob`);
      assert.ok(Array.isArray(graph["@graph"]) && graph["@graph"].length >= 2, `${name}: no @graph to resolve the @ids against`);
    }
  }
});

test("every fact in the graph came from the register, at the address the page is standing at", () => {
  const { files } = built();
  for (const route of livePages) {
    for (const lang of LANGS) {
      const name = distPath(route, lang);
      const html = String(files.get(name));
      const nodes = new Map(nodesIn(html).map((node) => [node["@type"], node]));

      // Equal to the module's own object, key for key: nothing between here and
      // the document — the dictionary above all — edited a byte of it.
      assert.deepEqual(nodes.get("Organization"), organizationNode(), `${name}: the Organization is not what company.mjs would generate`);
      assert.equal(
        decode(nodes.get("WebPage").name),
        decode(/<title>([\s\S]*?)<\/title>/.exec(html)[1]),
        `${name}: the graph names a different page than the <title> beside it does`,
      );
      assert.equal(
        decode(nodes.get("WebPage").description),
        decode(/<meta name="description" content="([^"]*)"/.exec(html)[1]),
        `${name}: the graph's description is not the meta description beside it`,
      );

      // The same facts, named the way the register names them.
      const org = nodes.get("Organization");
      assert.equal(org.name, company.name);
      assert.equal(org.email, company.email);
      assert.equal(org.url, `${company.origin}/`, `${name}: the company is rooted somewhere other than the one host that answers (ADR 0006)`);
      assert.deepEqual(org.sameAs, [...company.sameAs], `${name}: sameAs drifted from the register`);
      assert.deepEqual(org.identifier, [{ "@type": "PropertyValue", propertyID: "KvK-nummer", name: "KvK-nummer", value: company.kvk }]);
      assert.deepEqual(org.address, { "@type": "PostalAddress", addressLocality: company.locality, addressCountry: company.countryCode });
    }
  }
});

test("the footer and the graph agree about the company's number", () => {
  // The prose and the machine-readable claim are two statements of one fact, and
  // this is the one place the site is allowed to state it twice. They also spell
  // the registry the same way, which is what made the pair checkable at all.
  const { files } = built();
  for (const lang of LANGS) {
    const html = String(files.get(distPath(home, lang)));
    assert.ok(html.includes(`KvK-nummer: ${company.kvk}`), `${at(home.key, lang)}: the footer's KvK line is not the register's number`);
    assert.ok(html.includes(`"value": "${company.kvk}"`), `${at(home.key, lang)}: the graph's identifier is not the register's number`);
  }
});

test("what ADR 0011 declined to say is absent, not empty", () => {
  const { graphs } = built();
  const forbidden = [
    "legalName", "legalForm", "foundingDate", "dateModified", "datePublished",
    "telephone", "faxNumber", "streetAddress", "postalCode", "geo", "currency",
    "employee", "employees", "numberofEmployees", "founder", "author", "authors",
  ];
  for (const [name, blocks] of graphs) {
    for (const graph of blocks) {
      walk(graph, (key, value) => {
        assert.ok(!forbidden.includes(key), `${name}: a ${key} in the graph is a claim nobody made`);
        assert.ok(value !== null && value !== undefined, `${name}: a ${key} that is null still says something`);
      });
      for (const node of graph["@graph"]) {
        assert.ok(
          ["Organization", "WebSite", "WebPage", "Service", "BreadcrumbList"].includes(node["@type"]),
          `${name}: a ${node["@type"]} node — LocalBusiness and its family are the map pack's instrument (ADR 0011)`,
        );
        assert.ok(!JSON.stringify(node).includes("Person"), `${name}: a Person is the site naming somebody (ADR 0008)`);
        assert.ok(!/"@type":\s*"(FAQPage|HowTo)"/.test(JSON.stringify(node)), `${name}: a rich result Google retired in August 2023`);
      }
    }
  }

  // The two claims that live outside a graph but inside a deployment.
  const { files } = built();
  assert.ok(![...files.keys()].includes("llms.txt"), "an unofficial file no engine is known to read");
  for (const name of files.keys()) {
    assert.ok(!String(files.get(name)).includes("Spieringdam"), `${name}: the street is back, and it is in the graph for the scrapers to keep (ADR 0011)`);
  }
});

test("the site is described once, in both languages, and says it is bilingual", () => {
  const { files } = built();
  const nodeAt = (lang) => nodesIn(files.get(distPath(home, lang))).find((node) => node["@type"] === "WebSite");

  assert.deepEqual(nodeAt("nl"), webSiteNode(), "the WebSite node is not what routes.mjs would generate");
  assert.deepEqual(nodeAt("nl").inLanguage, [...LANGS], "the site claims one language, or none");
  assert.equal(
    JSON.stringify(nodeAt("nl")),
    JSON.stringify(nodeAt("en")),
    "the WebSite node differs by variant, which makes it two statements about one site",
  );
});

test("a WebPage node's @id is the address its own page canonicals", () => {
  // R3's three places, now four: canonical, sitemap, hreflang and the graph.
  const { files } = built();
  for (const route of livePages) {
    for (const lang of LANGS) {
      const html = String(files.get(distPath(route, lang)));
      const canonical = /rel="canonical" href="([^"]*)"/.exec(html)[1];
      const graph = graphsIn(html)[0];
      const page = graph["@graph"].find((node) => node["@type"] === "WebPage");

      assert.equal(page["@id"], canonical, `${at(route.key, lang)}: the graph and the canonical name two addresses for one page`);
      assert.equal(page.url, canonical, `${at(route.key, lang)}: a WebPage whose url is not its own address`);
      assert.equal(page.inLanguage, lang, `${at(route.key, lang)}: the graph's language is not the variant's`);

      const declared = new Set(graph["@graph"].map((node) => node["@id"]));
      // The one pointer allowed to leave this document: ADR 0011 puts the Site
      // node on the home Pages, so every other Page points at it rather than
      // restating it. U9's service and trail are not exempt. They describe this
      // address, so a reader that resolves the pointer must find the node here.
      const elsewhere = new Set([webSiteNode()["@id"]]);
      for (const ref of [...JSON.stringify(graph).matchAll(/"@id": ?"([^"]+)"/g)].map((m) => m[1])) {
        assert.ok(
          declared.has(ref) || elsewhere.has(ref),
          `${at(route.key, lang)}: ${ref} is pointed at and never described, so the pointer is all a reader gets`,
        );
      }
    }
  }
});

test("a Practice area is something the firm sells, and an industry is somewhere it sells it (R11)", () => {
  const { files } = built();
  let services = 0;
  for (const route of livePages) {
    for (const lang of LANGS) {
      const name = distPath(route, lang);
      const nodes = new Map(nodesIn(String(files.get(name))).map((node) => [node["@type"], node]));
      const service = nodes.get("Service");

      if (!route.practice) {
        assert.equal(service, undefined, `${at(route.key, lang)}: a Service on an industry Page sells the sector rather than the work`);
        continue;
      }
      services += 1;
      const canonical = urlOf(route.key, lang);
      assert.equal(service["@id"], `${canonical}#service`, `${name}: the service is addressed somewhere other than this page`);
      assert.equal(decode(service.name), decode(route.name[lang]), `${name}: the Service's name is not the route table's, in this language`);
      assert.equal(service.url, canonical, `${name}: a service offered at an address other than the one describing it`);
      assert.deepEqual(
        service.provider,
        { "@id": `${company.origin}/#organization` },
        `${name}: a Service that restates the KvK number is the graph's second copy of a fact (ADR 0011)`,
      );
      assert.equal(service.areaServed, company.serviceAreaCountryCode, `${name}: the service area is not the register's`);
      assert.deepEqual(nodes.get("WebPage").mainEntity, { "@id": service["@id"] }, `${name}: the page does not say which entity it is about`);
      assert.deepEqual(service, serviceNode({ route, lang }), `${name}: not what graph.mjs would generate`);
    }
  }
  assert.equal(services, 6, "three Practice areas, two variants - a fourth is a claim about a service nobody named");
});

test("every Page but the home one says what is above it, in its own language (R11)", () => {
  const { files } = built();
  for (const route of livePages) {
    for (const lang of LANGS) {
      const name = distPath(route, lang);
      const nodes = new Map(nodesIn(String(files.get(name))).map((node) => [node["@type"], node]));
      const trail = nodes.get("BreadcrumbList");

      if (route.key === "home") {
        assert.equal(trail, undefined, `${name}: a trail one crumb deep is the page pointing at itself`);
        continue;
      }

      const crumbs = breadcrumbs(route.key, lang);
      assert.deepEqual(trail, breadcrumbNode({ route, lang }), `${name}: not what the route table would generate`);
      assert.equal(trail.itemListElement.length, 2, `${name}: the site is two levels deep, and a third crumb would be an invented page`);
      assert.deepEqual(
        trail.itemListElement.map((item) => [item.position, decode(item.name), item.item]),
        crumbs.map((crumb, index) => [index + 1, crumb.name, crumb.href]),
        `${name}: the graph's trail and the route table's are two different paths`,
      );
      assert.equal(
        trail.itemListElement[trail.itemListElement.length - 1].item,
        /rel="canonical" href="([^"]*)"/.exec(String(files.get(name)))[1],
        `${name}: a trail that ends somewhere other than the page standing on it`,
      );
      assert.deepEqual(nodes.get("WebPage").breadcrumb, { "@id": trail["@id"] }, `${name}: the page does not point at its own trail`);
    }
  }
});

test("nothing but a Page describes the company", () => {
  const { graphs } = built();
  const silent = new Map([...graphs].filter(([name]) => !livePages.some((route) => LANGS.some((lang) => distPath(route, lang) === name))));

  assert.equal(diagrams.length, 4, "the count this test depends on");
  for (const route of diagrams) {
    assert.ok(!silent.has(distPath(route, "nl")) || silent.get(distPath(route, "nl")).length === 0, `${route.key}: a graph on a Diagram page is a claim about the company on the page that is defined by not being one`);
  }
  assert.ok(silent.get("404.html") === undefined || silent.get("404.html").length === 0, "the not-found page introduces the firm to nobody");
  assert.equal(silent.size, diagrams.length + 1, "a document this test did not expect to check");
});

/** The page's own entity encoding, undone, so a `&` compares with a `&amp;`. */
function decode(text) {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

/** Every key/value pair in a JSON tree, including the keys of array items. */
function walk(value, visit, key = "") {
  if (key) visit(key, value);
  if (Array.isArray(value)) return value.forEach((item) => walk(item, visit, key));
  if (value && typeof value === "object") return Object.entries(value).forEach(([k, v]) => walk(v, visit, k));
  return undefined;
}
