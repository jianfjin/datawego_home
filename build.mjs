#!/usr/bin/env node

/**
 * The only writer of `dist/` (ADR 0003).
 *
 * `node build.mjs`      write dist/
 * `node build.mjs --check`  prove dist/ is what the source says, and exit 1 if not
 *
 * It is a plain script rather than a toolchain because the site is a plain site:
 * one Page source per Page, one route table, one dictionary, and no dependency to
 * install. Everything it emits is derived, so the file it writes is never the
 * thing to edit — which is the property that keeps ten addresses from drifting
 * apart, and the reason `--check` can exist at all.
 */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { company } from "./src/site/company.mjs";
import { LANGS, ROUTES, ROOT_LANG, assertRoutes, isVariantBearing, urlOf } from "./src/site/routes.mjs";
import { CHROME_TOKENS, PAGE_SOURCES, leakedRouteLinks, renderVariant, sourceProblems, themeBoot } from "./src/site/page.mjs";
import { PAGE_BODIES } from "./src/site/pages.mjs";
import { staticAssets } from "./src/site/static.mjs";
import { applyDiagramHead } from "./src/site/diagrams.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const CHECK = process.argv.includes("--check");
const ONLY = flagValue("--only");

/**
 * An artwork *reference*, as opposed to an artwork mentioned in prose. A page
 * names where a file lives in an attribute; a comment names where a file came
 * from. Only the first is a request: `resources/DataWeGo_banner3.png` appears in
 * this repository's HTML exactly once, in the sentence explaining what the hero
 * WebP files were derived from, and it is 1.4MB of PNG. Shipping a file on the
 * strength of a sentence is the kind of quiet `--check` exists to prevent.
 */
const ASSET_REF = /resources\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|svg|gif|avif)/g;

function assetReferences(document) {
  const comments = [...document.matchAll(/<!--[\s\S]*?-->/g)].map((m) => [m.index, m.index + m[0].length]);
  const insideComment = (offset) => comments.some(([from, to]) => offset >= from && offset < to);
  return [...document.matchAll(ASSET_REF)].filter((match) => !insideComment(match.index));
}

const ROUTES_JSON = JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }, null, 2) + "\n";

function flagValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  const inline = process.argv[i].split("=");
  return inline.length > 1 ? inline[1] : process.argv[i + 1] ?? null;
}

/**
 * The file an asset address is served from. The address says `/docs/<name>`,
 * the drawing on disk is `<name>.html`, and Pages answers the bare address from
 * that file — so the extension belongs here and nowhere a link can carry it
 * (ADR 0005). Naming it once is also what lets the source read below and the
 * dist write agree without either one saying the other's name.
 */
function assetFile(route) {
  const pathname = new URL(urlOf(route.key, ROOT_LANG)).pathname;
  return path.join(...pathname.split("/").filter(Boolean)) + ".html";
}

/** Where an address lives on disk. `dist/` mirrors the URL tree, directory form. */
function distPath(route, lang) {
  const address = urlOf(route.key, lang);
  const pathname = new URL(address).pathname;
  if (route.form === "asset") return assetFile(route);
  if (pathname === "/") return "index.html";
  return path.join(...pathname.split("/").filter(Boolean), "index.html");
}

/** What this build writes, in one pass, as name → bytes. */
function generate() {
  const problems = [];
  const files = new Map();
  let boot = null;

  assertRoutes();
  problems.push(...sourceProblems(read("datawego-company-site.html")));

  for (const route of ROUTES) {
    if (route.status !== "live") continue;
    if (ONLY && route.key !== ONLY) continue;

    if (isVariantBearing(route)) {
      const sourceFile = pageSourceFor(route);
      if (sourceFile === null) {
        problems.push(`${route.key}: declared live with no Page source. A body page needs its own file (R16)`);
        continue;
      }
      const source = read(sourceFile);
      // The chrome is read, never copied: five Pages share one header because one
      // file holds it, and reading it per route keeps `--check` honest about that.
      const chromeSource = sourceFile === PAGE_SOURCES.home ? null : read(PAGE_SOURCES.home);
      for (const lang of LANGS) {
        const out = renderVariant({ route, lang, source, chromeSource });
        if (out.problems.length) {
          problems.push(`${route.key}.${lang}:\n    - ${out.problems.join("\n    - ")}`);
          continue;
        }
        files.set(distPath(route, lang), linkChrome(out, files));

        // The not-found page is the one document in the build that is not
        // rendered from a Page source, so the chrome it shares is read off the
        // page that is — the Dutch home, because the Dutch root is what an
        // unknown address falls back to (ADR 0001).
        if (!ONLY && route.key === "home" && lang === ROOT_LANG) boot = themeBoot(out.html, problems);
      }
      continue;
    }

    // Diagram pages: served and linked, never indexed (ADR 0002). The drawing
    // is archify's and is handed on byte for byte; the head that says so is
    // this repository's, and it is written here rather than in docs/*.html so
    // that regenerating a diagram cannot undocument the site (R8).
    const from = assetFile(route);
    if (!fs.existsSync(path.join(ROOT, from))) {
      problems.push(`${route.key}: ${from} is missing — a committed diagram page has to exist to be served`);
      continue;
    }
    const drawn = applyDiagramHead(read(from), route);
    problems.push(...drawn.problems);
    if (!drawn.problems.length) files.set(distPath(route, "nl"), drawn.html);
  }

  if (!ONLY) {
    const statics = staticAssets({
      robotsSource: read("src/robots.txt"),
      notFoundSource: read("src/404.nl.html"),
      cssHref: sharedStylesheet(files, problems),
      boot,
    });
    problems.push(...statics.problems);
    for (const [name, contents] of statics.files) files.set(name, contents);
  }

  shipAssets(files, problems);
  files.set("_routes.json", ROUTES_JSON);

  // Last, so a step added after it cannot leave a token in what this build
  // claims to have written. A browser asks for `{{CHROME_CSS}}` as a path, and
  // for `{{LINK:<key>}}` as a page that does not exist.
  for (const [name, bytes] of files) {
    const text = String(bytes);
    const leaked = Object.values(CHROME_TOKENS).find((token) => text.includes(token));
    if (leaked) problems.push(`${name} still holds ${leaked} — the chrome was rendered but never linked`);
    for (const key of leakedRouteLinks(text)) {
      problems.push(`${name} still holds a link to ${key} — the route was named but never answered`);
    }
  }

  return { files, problems };
}

/**
 * Name the chrome by what it contains, and point the page at it.
 *
 * Two variants whose CSS is identical get one file, because the hash is the
 * contents and the contents are the same — which is the whole of ADR 0004 in
 * four lines: a visitor who reads three pages of either language fetches the
 * stylesheet once. The behaviour file differs per language by construction (the
 * sentences the form says are in the page's own language), so it lands as two
 * files, and each visitor downloads the one they will ever be shown.
 */
function linkChrome(rendered, files) {
  let html = rendered.html;
  for (const [kind, contents] of Object.entries(rendered.chrome)) {
    const token = CHROME_TOKENS[kind];
    if (!token) throw new Error(`renderVariant emitted chrome of kind "${kind}", which build.mjs has no name for`);
    const name = `assets/site.${digest(contents)}.${kind}`;
    if (!files.has(name)) files.set(name, contents);
    html = html.split(token).join(`/${name}`);
  }
  return html;
}

/**
 * The chrome's one stylesheet, by the name this build gave it.
 *
 * Asked of the files rather than recomputed, because the name is a hash of the
 * contents and a second way to compute it is a second thing that can be wrong.
 */
function sharedStylesheet(files, problems) {
  const sheets = [...files.keys()].filter((name) => name.endsWith(".css"));
  if (sheets.length !== 1) {
    problems.push(`${sheets.length} stylesheets were written, so the not-found page cannot be pointed at the one the site shares (ADR 0004)`);
    return null;
  }
  return `/${sheets[0]}`;
}

/**
 * The authored source behind a route.
 *
 * Home is the whole document; the other four Pages are bodies composed onto it
 * (`src/site/pages.mjs`), and a live Page route that names no file is a build
 * failure rather than an empty page: its copy is what is missing, not its path,
 * and a page ships with its words or does not ship (R16).
 */
function pageSourceFor(route) {
  if (route.key === "home") return PAGE_SOURCES.home;
  return PAGE_BODIES[route.key] ?? null;
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

/**
 * Ship the artwork the pages actually name, under a name chosen from its bytes.
 *
 * `resources/` holds 15.7MB of brand art, and six of its thirteen files are the
 * same footer PNG by a different name — so copying the directory used to put
 * 16MB on a visitor who was ever only asked for two images (R10). The reference
 * is now the declaration instead: what no page names stays in the repository,
 * what a page names and cannot find fails the build, and every shipped file is
 * named by its contents, which is what lets `/assets/*` call itself immutable
 * without lying (ADR 0004). A replaced banner therefore arrives at a new URL,
 * and nobody has to remember to purge a cache.
 */
function shipAssets(files, problems) {
  const named = new Set();
  const documents = [];
  for (const [name, bytes] of files) {
    const text = String(bytes);
    const found = assetReferences(text);
    if (!found.length) continue;
    documents.push(name);
    for (const match of found) named.add(match[0]);
  }

  const renamed = new Map();
  for (const logical of [...named].sort()) {
    const absolute = path.join(ROOT, logical);
    if (!fs.existsSync(absolute)) {
      problems.push(
        `${logical} is named by a page and is not in the repository — run \`python3 tools/derive-images.py\`, or stop naming it`,
      );
      continue;
    }
    const bytes = fs.readFileSync(absolute);
    const base = path.basename(logical);
    const dot = base.lastIndexOf(".");
    const shipped = `assets/${base.slice(0, dot)}.${digest(bytes)}${base.slice(dot)}`;
    files.set(shipped, bytes);
    renamed.set(logical, shipped);
  }

  for (const name of documents) {
    const text = String(files.get(name));
    const requests = new Set(assetReferences(text).map((m) => `${m[0]}@${m.index}`));
    // The callback's offsets are into the string it was handed, so the comment
    // ranges and the match ranges are measured on one ruler. Prose keeps naming
    // the file it came from; only the requests move.
    files.set(
      name,
      text.replace(ASSET_REF, (logical, offset, document) => {
        if (!requests.has(`${logical}@${offset}`)) return logical;
        const shipped = renamed.get(logical);
        /*
         * Rooted, not relative. `assets/<name>` resolves against the directory of
         * the page carrying it, which is the root for the Dutch homepage and `/en/`
         * for its English variant — so one file became two addresses, and the page
         * the site offers as `x-default` asked for `/en/assets/logo…` and was
         * answered with 404. A reference that is already an absolute URL keeps its
         * length, because there the origin has done the rooting (`og:image`).
         */
        return document.slice(0, offset).endsWith("/") ? shipped : `/${shipped}`;
      }),
    );
  }
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

function main() {
  const started = Date.now();
  const { files, problems } = generate();

  if (problems.length) {
    process.stderr.write(`\n✗ build refused:\n\n  - ${problems.join("\n  - ")}\n\n`);
    process.exit(1);
  }

  if (CHECK) {
    const stale = [];
    for (const [name, bytes] of files) {
      const target = path.join(DIST, name);
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(Buffer.from(bytes))) {
        stale.push(name);
      }
    }
    const extra = [];
    if (!ONLY && fs.existsSync(DIST)) {
      const expected = new Set(files.keys());
      for (const name of [...listFiles(DIST)]) {
        if (!expected.has(name)) extra.push(name);
      }
    }
    if (stale.length || extra.length) {
      process.stderr.write(
        `\n✗ dist/ is not what the source says.\n` +
          (stale.length ? `  stale: ${stale.join(", ")}\n` : "") +
          (extra.length ? `  not generated (stays as is, but nothing in the repo can put it there): ${extra.join(", ")}\n` : "") +
          `\n  Run \`node build.mjs\` and commit the source change, not dist/.\n\n`,
      );
      process.exit(1);
    }
    process.stdout.write(
      `✓ dist/ matches the source — ${files.size} file(s), ${fmt(sizeOf(files))}, ${Date.now() - started} ms\n`,
    );
    return;
  }

  if (!ONLY) {
    // A dist/functions or dist/_worker.js would ship the Function's source as a
    // public asset, so an assembly that leaves one behind is not resumable.
    for (const hazard of ["_worker.js", "functions"]) {
      if (fs.existsSync(path.join(DIST, hazard))) {
        process.stderr.write(
          `✗ dist/${hazard} exists — it would deploy as an asset beside the Function. Remove dist/ and re-run.\n`,
        );
        process.exit(1);
      }
    }
    fs.rmSync(DIST, { recursive: true, force: true });
  }

  for (const [name, bytes] of files) {
    const target = path.resolve(DIST, name);
    if (!target.startsWith(path.resolve(DIST) + path.sep)) {
      process.stderr.write(`\u2717 ${name} would be written outside dist/ — a route or a copy source is wrong\n`);
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }

  const pages = [...files.keys()].filter((n) => n.endsWith("index.html"));
  process.stdout.write(
    `✓ dist/ assembled — ${files.size} file(s), ${fmt(sizeOf(files))}\n` +
      pages.map((n) => `    ${n.padEnd(22)} ${fmt(bytesOf(files.get(n)))}`).join("\n") +
      `\n\n  addresses now:\n${addressesWritten(files).map((url) => `    ${url}`).join("\n")}\n`,
  );
}

/**
 * The addresses this run actually put on disk, in route-table order.
 *
 * Derived from the written file names rather than from the table alone, because
 * `--only` is a real mode: a summary that names ten addresses after writing one
 * page is the build describing a deployment it did not make.
 */
function addressesWritten(files) {
  return ROUTES.filter((route) => route.status === "live")
    .flatMap((route) => (isVariantBearing(route) ? LANGS : [ROOT_LANG]).map((lang) => ({
      name: distPath(route, lang),
      url: urlOf(route.key, lang),
    })))
    .filter(({ name }) => files.has(name))
    .map(({ url }) => url);
}

function* listFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* listFiles(absolute);
    else yield path.relative(DIST, absolute).split(path.sep).join("/");
  }
}

function sizeOf(files) {
  let total = 0;
  for (const bytes of files.values()) total += Buffer.byteLength(bytes);
  return total;
}
const bytesOf = (text) => Buffer.byteLength(text);
const fmt = (n) => (n > 1024 ? `${(n / 1024).toFixed(1)}KB` : `${n}B`);

if (import.meta.url === `file://${process.argv[1]}`) main();
export { generate, distPath, pageSourceFor, shipAssets, addressesWritten };
