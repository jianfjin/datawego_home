/**
 * The four files a site owes that are not pages.
 *
 * `robots.txt`, `sitemap.xml`, `_headers` and `404.html` are the four answers a
 * crawler gets before it reads a word of copy, and none of them is a Page: no
 * language variants, no dictionary, no chrome to split. So they are built here,
 * from the two places that already know what they say — the route table (every
 * address, ADR 0005) and the register (every company fact, ADR 0011).
 *
 * Why generated rather than dropped into `dist/` by hand, in one line each:
 *
 * - `sitemap.xml` lists what `sitemapUrls()` returns. A hand-kept sitemap is how
 *   the reference project ended up naming an address its own canonical did not
 *   (R6, and the defect that plan was written to avoid);
 * - `robots.txt` is authored in `src/robots.txt` — the stance is a human
 *   decision (ADR 0007) — and gains its `Sitemap:` line from the register, so
 *   the one URL in the file nobody can check by eye is never the one that rots;
 * - `_headers` cannot be authored at all, because `Cache-Control: immutable` has
 *   to be true of a name the build chose (R9, ADR 0004);
 * - `404.html` is authored in `src/404.nl.html` and filled with the same two
 *   chrome files and the same two addresses the generated pages carry.
 *
 * Two guards here exist because a future edit would otherwise *improve* the
 * site into a defect: an authored `Sitemap:` line (two of them, and crawlers
 * believe the wrong one), a `Disallow` covering `/docs/` (ADR 0007's trap — a
 * `noindex` only counts on a page that can be fetched), and a `canonical` on the
 * 404 (Google's soft-404 invitation, in the site's own hand).
 *
 * What is deliberately not here: `Permissions-Policy`. The enquiry form loads
 * Cloudflare Turnstile in an iframe, and a policy that is wrong for it fails
 * silently in the one place the site asks a stranger for their phone number.
 */
import { company } from "./company.mjs";
import { sitemapUrls, urlOf } from "./routes.mjs";
import { CHROME_TOKENS } from "./page.mjs";
import { encodeText } from "./markup.mjs";

/** The two paths that answer as themselves, and appear in no route table. */
export const ROBOTS_PATH = "/robots.txt";
export const SITEMAP_PATH = "/sitemap.xml";

/** What `src/404.nl.html` cannot know without naming a second source of truth. */
export const ADDRESS_TOKENS = Object.freeze({
  homeNl: "{{URL_HOME_NL}}",
  homeEn: "{{URL_HOME_EN}}",
  email: "{{COMPANY_EMAIL}}",
});

const TOKEN = /\{\{[A-Z_]+\}\}/g;

/**
 * robots.txt: the authored stance, plus the one line the build knows.
 *
 * The `Sitemap:` line is appended rather than substituted because an authored
 * file that needs a token in it is a file that reads wrong opened on its own.
 */
export function robotsFile(authored) {
  const problems = robotsProblems(authored);
  if (problems.length) return { contents: "", problems };
  const contents = `${authored.trimEnd()}\n\nSitemap: ${company.origin}${SITEMAP_PATH}\n`;
  return { contents, problems };
}

function robotsProblems(authored) {
  const problems = [];

  if (/^\s*sitemap\s*:/im.test(authored)) {
    problems.push(
      "src/robots.txt states a Sitemap: line and the build appends one, so the file would name the sitemap twice — and two statements of one address is the thing this plan exists to stop (ADR 0007)",
    );
  }

  /*
   * A group is the consecutive `User-agent:` lines before its rules, which is how
   * RFC 9309 reads the file — and why a block that names seven crawlers is seven
   * lines and not seven copies of the same `Disallow:`.
   */
  let agents = [];
  let sealed = false;
  for (const line of authored.split("\n")) {
    const statement = line.replace(/#.*$/, "").trim();
    if (statement === "") continue;

    const agent = /^user-agent\s*:\s*(\S*)$/i.exec(statement);
    if (agent) {
      if (!agent[1]) {
        problems.push(`src/robots.txt has a User-agent with nothing named after it: ${JSON.stringify(line)}`);
        continue;
      }
      if (sealed) { agents = []; sealed = false; }
      agents.push(agent[1]);
      continue;
    }
    sealed = true;

    const disallow = /^disallow\s*:\s*(\S*)$/i.exec(statement);
    if (!disallow) continue;
    const value = disallow[1];

    if (value.startsWith("/docs")) {
      problems.push(
        `src/robots.txt disallows ${JSON.stringify(value)} (for ${agents.join(", ")}), which is the trap ADR 0007 records: the Diagram pages are kept out of the index by a noindex inside the page, and a noindex on a page no crawler may fetch leaves the URL indexed as a bare entry with no description`,
      );
    }
    if (value !== "" && agents.includes("*")) {
      problems.push(
        `src/robots.txt disallows ${JSON.stringify(value)} for every crawler, which is the 119KB generated answer this file was written to replace (ADR 0007)`,
      );
    }
  }

  return problems;
}

/**
 * sitemap.xml, one `<url>` per live indexable variant.
 *
 * No `<lastmod>`, because the only date this build could put there is today's,
 * which would be a claim about when the copy changed that nothing in the
 * repository knows (R11 refuses an invented `dateModified` for the same reason).
 * The sitemap's value here is the address set and nothing else.
 */
export function sitemapXml() {
  const urls = sitemapUrls();
  const problems = urls.length
    ? []
    : ["the sitemap would list nothing: no indexable route is live (ADR 0002)"];
  const body = urls.map((url) => `  <url><loc>${encodeText(url)}</loc></url>`).join("\n");
  const contents =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  return { contents, problems };
}

/**
 * The cache and security headers, in the shape Cloudflare Pages parses.
 *
 * Two facts from the Pages docs are load-bearing here, and both are easy to get
 * wrong from the file's own syntax:
 *
 * - a request that matches more than one rule inherits **all** of them, and a
 *   header applied twice is **joined with a comma** — so `/assets/*` has to
 *   detach the `/*` value with `! Cache-Control` before setting its own, or the
 *   hashed chrome arrives as `public, max-age=0, must-revalidate, public,
 *   max-age=31536000, immutable`, which is one header saying two opposite things
 *   and whichever cache obeys is a coin toss;
 * - `_headers` is **not applied to Functions responses**, so `/api/contact`
 *   inherits none of this. The HSTS line therefore does not cover the API; it is
 *   worth stating out loud rather than assuming, and the Function is the place
 *   to add anything the API must itself send.
 *
 * No `X-Robots-Tag` anywhere in it (ADR 0006): the file applies to a whole Pages
 * project rather than to one host, so a noindex written here noindexes the
 * canonical site too. `resources/` keeps `must-revalidate` on purpose — those
 * names are not content-hashed, so an immutable copy of a replaced banner is a
 * worse bug than one more revalidation per visit.
 */
export function headersFile() {
  return {
    contents:
      `# Generated by build.mjs. The chrome names in /assets/* are chosen from\n` +
      `# what they contain, which is what makes them cacheable forever (ADR 0004, R9).\n` +
      `/*\n` +
      `  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\n` +
      `  X-Content-Type-Options: nosniff\n` +
      `  Referrer-Policy: strict-origin-when-cross-origin\n` +
      `  X-Frame-Options: DENY\n` +
      `  Cache-Control: public, max-age=0, must-revalidate\n` +
      `\n` +
      `/assets/*\n` +
      `  ! Cache-Control\n` +
      `  Cache-Control: public, max-age=31536000, immutable\n`,
    problems: [],
  };
}

/**
 * The 404, with the site's chrome filled in.
 *
 * What it must not acquire is a canonical, an `hreflang` set or a fetch of its
 * own behaviour: a missing page that runs something is a missing page that can
 * be wrong in a new way.
 */
export function notFoundPage({ source, cssHref, boot }) {
  const problems = [];
  const fills = new Map([
    [CHROME_TOKENS.css, cssHref],
    [CHROME_TOKENS.boot, boot],
    [ADDRESS_TOKENS.homeNl, urlOf("home", "nl")],
    [ADDRESS_TOKENS.homeEn, urlOf("home", "en")],
    [ADDRESS_TOKENS.email, company.email],
  ]);

  for (const token of [CHROME_TOKENS.css, CHROME_TOKENS.boot]) {
    if (!source.includes(token)) {
      problems.push(`src/404.nl.html no longer holds ${token}, so the not-found page stopped sharing the site's chrome (ADR 0004)`);
    }
  }

  let html = source;
  for (const [token, value] of fills) {
    if (typeof value !== "string" || value === "") continue;
    html = html.split(token).join(value);
  }

  // The guards below read the markup rather than the file, because everything
  // this page must not do is worth explaining in a comment on the page that
  // explains it — and a comment that says "no canonical" is not a canonical.
  const markup = html.replace(/<!--[\s\S]*?-->/g, "");

  const left = markup.match(TOKEN);
  if (left) {
    problems.push(`src/404.nl.html holds ${[...new Set(left)].join(", ")}, which nothing in this build fills — a browser would ask for it as text and be answered with 404`);
  }
  if (/<link[^>]+rel=["']canonical["']/i.test(markup)) {
    problems.push(
      "src/404.nl.html declares a canonical. Pointing an address that does not exist at one that does is how a site asks to be read as a soft 404 (R7)",
    );
  }
  if (/hreflang\s*=/i.test(markup)) {
    problems.push("src/404.nl.html carries hreflang, which belongs to a Page and its variants rather than to a response (ADR 0002)");
  }
  if (!/content="noindex, follow"/i.test(markup)) {
    problems.push('src/404.nl.html no longer says `noindex, follow`. A 404 that is indexed is a result, and a result nobody asked for that says the site lost a page (R7)');
  }
  if (/<script[^>]+\ssrc=/i.test(markup)) {
    problems.push("src/404.nl.html fetches a script. Nothing on this page needs to run, and it has to answer in one round trip to be worth serving (R7)");
  }

  return { contents: html, problems };
}

/**
 * All four, as `generate()` wants them: name → bytes, and the reasons not to.
 *
 * `cssHref` and `boot` come from the Dutch home variant rather than from this
 * file, because the alternative is a second answer to "what is the site's
 * stylesheet called", and that answer is a hash.
 */
export function staticAssets({ robotsSource, notFoundSource, cssHref, boot }) {
  const robots = robotsFile(robotsSource);
  const sitemap = sitemapXml();
  const headers = headersFile();
  const notFound = notFoundPage({ source: notFoundSource, cssHref, boot });

  const entries = [
    ["robots.txt", robots],
    ["sitemap.xml", sitemap],
    ["_headers", headers],
    ["404.html", notFound],
  ];

  return {
    files: new Map(entries.map(([name, part]) => [name, part.contents])),
    problems: entries.flatMap(([, part]) => part.problems),
  };
}
