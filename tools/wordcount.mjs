/**
 * Count the words a visitor actually reads on every Page, in both variants.
 *
 * R16 set a budget of 400–700 words per new Page, and a budget nobody can
 * measure is a wish. The arithmetic lives in src/site/wordcount.mjs, which the
 * guard test calls too: what is printed here is what the assertion measured,
 * not a second opinion on it.
 *
 *   node tools/wordcount.mjs          # one build, counted
 */
import { generate, distPath } from "../build.mjs";
import { ROUTES, urlOf } from "../src/site/routes.mjs";
import { visibleWords } from "../src/site/wordcount.mjs";

const { files } = generate();
const rows = ROUTES.filter((route) => route.kind === "page" && route.status === "live").map((route) =>
  [route.key, ...["nl", "en"].map((lang) => visibleWords(String(files.get(distPath(route, lang)))))],
);

for (const [key, nl, en] of rows) {
  const route = ROUTES.find((candidate) => candidate.key === key);
  console.log(`${key.padEnd(30)} nl ${String(nl).padStart(4)}   en ${String(en).padStart(4)}   ${urlOf(key, "nl")} ${urlOf(key, "en")}`);
}
const budget = rows.filter(([key]) => key !== "home").flatMap(([, nl, en]) => [nl, en]).filter((n) => n < 400 || n > 700);
console.log(budget.length === 0 ? "\n✓ every new Page is inside R16's 400–700" : `\n✗ ${budget.length} variant(s) outside R16's 400–700: ${budget.join(", ")}`);
