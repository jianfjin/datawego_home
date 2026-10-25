#!/usr/bin/env node

/**
 * IndexNow notification: one POST that tells every engine sharing this site's
 * key that the addresses in dist/sitemap.xml just became true (ADR 0014).
 *
 * Nothing here decides what to send: the key comes from the same file the build
 * names the root document after, and the URLs come from the sitemap the same
 * build just wrote — so what a notification claims and what a deploy serves
 * cannot come apart without one of them failing first.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const key = fs.readFileSync(path.join(ROOT, "src/indexnow.key"), "utf8").trim();
if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  process.stderr.write("indexnow: src/indexnow.key is not a key in the protocol's alphabet — fix the file, not this tool\n");
  process.exit(2);
}

let sitemap;
try {
  sitemap = fs.readFileSync(path.join(ROOT, "dist/sitemap.xml"), "utf8");
} catch {
  process.stderr.write("indexnow: dist/sitemap.xml is not there to read — run `node build.mjs` first\n");
  process.exit(2);
}
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) {
  process.stderr.write("indexnow: the sitemap lists no addresses, and an empty notification is not a smaller success\n");
  process.exit(2);
}

// One key authorizes one host; the sitemap is the route table's own answer, so
// agreement among its URLs is the check, not a policy choice made here (ADR 0006).
const hosts = new Set(urls.map((u) => new URL(u).host));
if (hosts.size !== 1) {
  process.stderr.write(`indexnow: the sitemap names ${hosts.size} hosts, and one key covers exactly one\n`);
  process.exit(2);
}
const host = [...hosts][0];

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, urlList: urls }),
});
const body = await res.text();

// 202 is the documented first answer — received, key still being fetched — and
// every answer after it 200. Anything else is the engine's own words, printed.
if (res.status === 200 || res.status === 202) {
  process.stdout.write(
    `indexnow: ${urls.length} URLs notified for ${host} (HTTP ${res.status}${res.status === 202 ? " — first response: the engines are still fetching the key file" : ""})\n`,
  );
} else {
  process.stderr.write(`indexnow: HTTP ${res.status} — ${body.trim().slice(0, 500) || "(no body)"}\n`);
  process.exit(1);
}
