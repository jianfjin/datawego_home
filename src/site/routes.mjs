/**
 * The site's only list of addresses (ADR 0005).
 *
 * The sitemap, every page's `rel=canonical`, every `hreflang` set, the
 * navigation and the breadcrumbs are all derived from this table, so the four
 * cannot disagree — which is the failure mode that made the reference project's
 * canonical and sitemap name an address that Cloudflare Pages 308s somewhere
 * else. Nothing else in the repository writes a path.
 *
 * Three shapes per route, each one a decision already taken elsewhere:
 *
 * - `kind: "page"` is a Language-variant-bearing surface with two paths
 *   (ADR 0001); `kind: "diagram"` is one address, no variants, no `hreflang`,
 *   never in the sitemap (ADR 0002).
 * - `indexable: true` means search is asked to rank it. Exactly five pages are.
 * - `status: "live"` means the generator writes the file. `"planned"` means the
 *   route is declared so its address and its two display names stop being
 *   invented later — and it must appear in no link, no sitemap and no alternate
 *   set until it goes live, because a half-emitted mirror is an invalid
 *   `hreflang` set rather than a smaller site.
 *
 * Paths are the trailing-slash directory form, the address Cloudflare Pages
 * answers with 200 (ADR 0005); `form: "asset"` is the one exception, for the
 * Diagram pages, whose `.html` addresses predate this plan and would break the
 * links already on the site if renamed.
 */
import { company } from "./company.mjs";

export const LANGS = Object.freeze(["nl", "en"]);

/** Dutch owns the root (ADR 0001). */
export const ROOT_LANG = "nl";

/** English is the fallback nobody is steered into by a language sniff (ADR 0006). */
export const X_DEFAULT_LANG = "en";

export const ROUTES = Object.freeze([
  {
    key: "home",
    kind: "page",
    form: "directory",
    indexable: true,
    status: "live",
    path: { nl: "/", en: "/en/" },
    /**
     * The breadcrumb root is the brand rather than the word "Home": the site
     * never uses "Home" (no nav item, no dictionary key), and ADR 0005 derives
     * addresses and names from the words the site already says.
     */
    name: { nl: company.name, en: company.name },
  },
  {
    key: "dataplatforms",
    kind: "page",
    form: "directory",
    indexable: true,
    status: "planned", // live at Stage 2, with its copy (U9/U10)
    path: { nl: "/dataplatforms/", en: "/en/data-platforms/" },
    name: { nl: "Dataplatforms", en: "Data platforms" },
  },
  {
    key: "ai-oplossingen",
    kind: "page",
    form: "directory",
    indexable: true,
    status: "planned",
    path: { nl: "/ai-oplossingen/", en: "/en/ai-solutions/" },
    name: { nl: "AI-oplossingen", en: "AI-powered solutions" },
  },
  {
    key: "cloud-en-enterprise-software",
    kind: "page",
    form: "directory",
    indexable: true,
    status: "planned",
    path: {
      nl: "/cloud-en-enterprise-software/",
      en: "/en/cloud-and-enterprise-software/",
    },
    name: { nl: "Cloud- & enterprise-software", en: "Cloud & enterprise software" },
  },
  {
    key: "zorg-en-life-sciences",
    kind: "page",
    form: "directory",
    indexable: true,
    status: "planned",
    path: {
      nl: "/zorg-en-life-sciences/",
      en: "/en/healthcare-life-sciences/",
    },
    name: { nl: "Zorg & life sciences", en: "Healthcare & life sciences" },
  },

  // Evidence, not surfaces: served, linked, `noindex, follow` (ADR 0002).
  {
    key: "diagram-pharm-platform",
    kind: "diagram",
    form: "asset",
    indexable: false,
    status: "live",
    path: { nl: "/docs/pharm-platform.html", en: "/docs/pharm-platform.html" },
    name: { nl: "Pharm Platform", en: "Pharm Platform" },
  },
  {
    key: "diagram-ehr-etl-pipeline",
    kind: "diagram",
    form: "asset",
    indexable: false,
    status: "live",
    path: {
      nl: "/docs/etl-dataflow-with-prepass.html",
      en: "/docs/etl-dataflow-with-prepass.html",
    },
    name: { nl: "EHR ETL Pipeline", en: "EHR ETL Pipeline" },
  },
  {
    key: "diagram-marketing-research-swarm",
    kind: "diagram",
    form: "asset",
    indexable: false,
    status: "live",
    path: {
      nl: "/docs/marketing-research-swarm.html",
      en: "/docs/marketing-research-swarm.html",
    },
    name: { nl: "Marketing Research Swarm", en: "Marketing Research Swarm" },
  },
  {
    key: "diagram-ehr-transform-platform",
    kind: "diagram",
    form: "asset",
    indexable: false,
    status: "live",
    path: {
      nl: "/docs/ehr-platform-architecture-with-prepass.html",
      en: "/docs/ehr-platform-architecture-with-prepass.html",
    },
    name: { nl: "EHR Transform Platform", en: "EHR Transform Platform" },
  },
]);

export const routeByKey = new Map(ROUTES.map((route) => [route.key, route]));

/** The five surfaces search is asked to rank (ADR 0002). */
export const indexablePageRoutes = ROUTES.filter(
  (route) => route.kind === "page" && route.indexable,
);

export function isVariantBearing(route) {
  return route.kind === "page";
}

/** Absolute address of one variant, or of a single-address route. */
export function urlOf(key, lang = ROOT_LANG) {
  const route = routeByKey.get(key);
  if (!route) throw new Error(`no route named ${key}`);
  const wanted = isVariantBearing(route) ? lang : ROOT_LANG;
  const path = route.path[wanted];
  if (typeof path !== "string" || path === "") {
    throw new Error(`route ${key} has no ${wanted} path`);
  }
  return `${company.origin}${path}`;
}

/** Every address that is real today, for anything that must not link forward. */
export function liveUrls(lang) {
  return ROUTES.filter((route) => route.status === "live").map((route) =>
    urlOf(route.key, lang),
  );
}

/** `<link rel="alternate">` values for one page; empty for a diagram. */
export function alternateLinks(key) {
  const route = routeByKey.get(key);
  if (!isVariantBearing(route)) return [];
  const links = LANGS.map((lang) => ({ lang, href: urlOf(key, lang) }));
  links.push({ lang: "x-default", href: urlOf(key, X_DEFAULT_LANG) });
  return links;
}

/** `sitemap.xml` rows: live indexable variants, in table order (R6). */
export function sitemapUrls() {
  const urls = [];
  for (const route of ROUTES) {
    if (route.kind !== "page" || !route.indexable || route.status !== "live") continue;
    for (const lang of LANGS) urls.push(urlOf(route.key, lang));
  }
  return urls;
}

/** Breadcrumb trail for one variant; the root crumb is the brand (see above). */
export function breadcrumbs(key, lang) {
  const route = routeByKey.get(key);
  const home = { name: routeByKey.get("home").name[lang], href: urlOf("home", lang) };
  if (!route || route.key === "home" || !isVariantBearing(route)) return [home];
  return [home, { name: route.name[lang], href: urlOf(key, lang) }];
}

/**
 * What the generator would refuse to build. A non-empty array is a failed
 * build (R15), not a warning.
 */
export function routeProblems(routes = ROUTES) {
  const problems = [];
  const seenKeys = new Set();
  const seenUrls = new Set();

  for (const route of routes) {
    if (seenKeys.has(route.key)) problems.push(`duplicate route key: ${route.key}`);
    seenKeys.add(route.key);

    if (!route.indexable && route.kind === "page") {
      problems.push(`${route.key}: a page is either indexable or it is not shipped`);
    }
    if (route.indexable && route.kind !== "page") {
      problems.push(`${route.key}: a ${route.kind} is never an indexable surface (ADR 0002)`);
    }

    for (const lang of LANGS) {
      const path = route.path[lang];
      if (typeof path !== "string" || path === "") {
        problems.push(`${route.key}: missing ${lang} path`);
        continue;
      }
      if (!path.startsWith("/")) problems.push(`${route.key}.${lang}: not rooted: ${path}`);
      if (/[?#]/.test(path)) problems.push(`${route.key}.${lang}: query or fragment in an address`);

      if (route.form === "directory") {
        if (!path.endsWith("/")) problems.push(`${route.key}.${lang}: directory form needs a trailing slash: ${path}`);
        if (path.endsWith(".html/")) problems.push(`${route.key}.${lang}: a Page address carries no extension`);
        if (isVariantBearing(route) && lang === "en" && path !== "/en/" && !path.startsWith("/en/")) {
          problems.push(`${route.key}.${lang}: the English tree lives under /en/ (ADR 0001): ${path}`);
        }
        if (isVariantBearing(route) && lang === ROOT_LANG && path.startsWith("/en/")) {
          problems.push(`${route.key}.${lang}: Dutch addresses cannot live under /en/`);
        }
      }
      if (route.form === "asset" && path.endsWith("/")) {
        problems.push(`${route.key}.${lang}: an asset address has no trailing slash`);
      }

      /*
       * A single-address route fills both language slots with the same path, so
       * only the first pass may claim the address. If the two slots ever
       * disagree, that is the bug worth reporting — not a duplicate.
       */
      const claimsAnAddress = isVariantBearing(route) || lang === ROOT_LANG;
      if (claimsAnAddress) {
        const url = `${company.origin}${path}`;
        if (seenUrls.has(url)) problems.push(`duplicate address: ${url}`);
        seenUrls.add(url);
      }
    }

    if (!isVariantBearing(route) && route.path.nl !== route.path.en) {
      problems.push(
        `${route.key}: a single-address route declares two paths (ADR 0002)`,
      );
    }

    if (route.status === "live" && route.kind === "page") {
      const missing = LANGS.filter((lang) => !route.path[lang]);
      if (missing.length) {
        problems.push(`${route.key}: live with no ${missing.join("/")} variant — half a mirror is an invalid hreflang set (ADR 0001)`);
      }
    }
  }

  const home = routes.find((route) => route.key === "home");
  if (!home) problems.push("no home route");
  else {
    if (home.path.nl !== "/") problems.push("the root address belongs to Dutch (ADR 0001)");
    if (home.path.en !== "/en/") problems.push("the English home is /en/ (ADR 0001)");
  }
  if (!LANGS.includes(X_DEFAULT_LANG)) problems.push("x-default must name a shipped language");

  const indexablePages = routes.filter((r) => r.kind === "page" && r.indexable);
  if (indexablePages.length !== 5) {
    problems.push(`${indexablePages.length} indexable surfaces; ADR 0002 settled on five`);
  }
  return problems;
}

export function assertRoutes() {
  const problems = routeProblems();
  if (problems.length) {
    throw new Error(`route table is invalid:\n  - ${problems.join("\n  - ")}`);
  }
  return true;
}
