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
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { company } from "./src/site/company.mjs";
import { ROUTES, assertRoutes, isVariantBearing, urlOf } from "./src/site/routes.mjs";
import { renderVariant, sourceProblems } from "./src/site/page.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const CHECK = process.argv.includes("--check");
const ONLY = flagValue("--only");

const ROUTES_JSON = JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }, null, 2) + "\n";

function flagValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  const inline = process.argv[i].split("=");
  return inline.length > 1 ? inline[1] : process.argv[i + 1] ?? null;
}

/** Where an address lives on disk. `dist/` mirrors the URL tree, directory form. */
function distPath(route, lang) {
  const address = urlOf(route.key, lang);
  const pathname = new URL(address).pathname;
  if (route.form === "asset") return path.join(...pathname.split("/").filter(Boolean));
  if (pathname === "/") return "index.html";
  return path.join(...pathname.split("/").filter(Boolean), "index.html");
}

/** What this build writes, in one pass, as name → bytes. */
function generate() {
  const problems = [];
  const files = new Map();

  assertRoutes();
  problems.push(...sourceProblems(read("datawego-company-site.html")));

  for (const route of ROUTES) {
    if (route.status !== "live") continue;
    if (ONLY && route.key !== ONLY) continue;

    if (isVariantBearing(route)) {
      const sourceFile = pageSourceFor(route);
      const source = read(sourceFile);
      for (const lang of ["nl", "en"]) {
        const out = renderVariant({ route, lang, source });
        if (out.problems.length) {
          problems.push(`${route.key}.${lang}:\n    - ${out.problems.join("\n    - ")}`);
          continue;
        }
        files.set(distPath(route, lang), out.html);
      }
      continue;
    }

    // Diagram pages: served and linked, `noindex, follow` (ADR 0002). Their
    // head is still their own to write; U6 moves it here.
    const from = path.join("docs", path.basename(route.path.nl));
    if (!fs.existsSync(path.join(ROOT, from))) {
      problems.push(`${route.key}: ${from} is missing — a committed diagram page has to exist to be served`);
      continue;
    }
    files.set(distPath(route, "nl"), read(from));
  }

  if (ONLY === "pages" || ONLY === null) copyTree("resources", files);
  files.set("_routes.json", ROUTES_JSON);

  return { files, problems };
}

/** The authored source behind a route. One per Page for now; U9 adds the others. */
function pageSourceFor(route) {
  if (route.key === "home") return "datawego-company-site.html";
  throw new Error(
    `no Page source is registered for ${route.key}. Its copy is what is missing, not its path — a page ships with its words or does not ship (R16).`,
  );
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

/**
 * Copy a source tree into the build under the same name. Reads are collected
 * rather than written, so `--check` compares against the same bytes it would
 * install — and so a wrong prefix becomes a visible problem in one place, the
 * fence in `main`, instead of a build that quietly writes to the source tree.
 */
function copyTree(from, files) {
  const src = path.join(ROOT, from);
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const absolute = path.join(src, entry.name);
    if (entry.isDirectory()) {
      copyTree(`${from}/${entry.name}`, files);
      continue;
    }
    files.set(`${from}/${entry.name}`, fs.readFileSync(absolute));
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
      `\n\n  addresses now:\n${ROUTES.filter((r) => r.status === "live" && isVariantBearing(r))
        .flatMap((r) => ["nl", "en"].map((lang) => `    ${urlOf(r.key, lang)}`))
        .join("\n")}\n`,
  );
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
export { generate, distPath, pageSourceFor };
