/**
 * The words a visitor reads, counted once.
 *
 * R16 set a budget of 400-700 words per new Page, and a budget nobody can
 * measure is a wish. Two things read that number: the guard test that holds the
 * budget, and the tool that shows an owner the figures instead of only the
 * failure. Both call this, because the moment they disagree the test is no
 * longer measuring the copy — it is measuring whatever the difference is.
 *
 * The difference was found the hard way. Stripping tags with `<[^>]+>` and
 * counting what is left looks like the same question as "what does a visitor
 * read" and is not: the home document's header comment quotes the brand mark as
 * `<b>Data</b><i>WeGo</i>`, so the expression stops at the first `>` inside the
 * comment and the remaining ninety-odd words of it arrive as prose — in every
 * Page, because the chrome carries that comment. Add the `<title>` and the seven
 * `&amp;` a nav label and a bullet carry, and dataplatforms reads 776 words against
 * a budget of 700 while the person looking at it has been offered 677. The section
 * markers were never the problem — `── 4 · PRIJZEN` holds no `>`, so a tag
 * expression drops it cleanly — which is why the number read like a copy problem
 * rather than a measuring one.
 *
 * So what gets dropped is everything a browser does not paint: the head,
 * scripts, styles, inline SVG, comments, and entities that resolve to a symbol.
 * Cutting at `</head>` is what makes the comment case structural instead of a
 * second expression to forget, and it is why a Body may keep its section map.
 */

export function visibleText(html) {
  return String(html)
    .slice(String(html).indexOf("</head>") + 7)
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function visibleWords(html) {
  return visibleText(html)
    .split(" ")
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}
