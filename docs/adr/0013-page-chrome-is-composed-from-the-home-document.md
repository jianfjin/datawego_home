# Page chrome is composed from the home document, not copied into four more

ADR 0004 settled the styling and the behavior: the generated page links
`site.css` and `site.js` by name rather than carrying them inline. It said
nothing about the HTML around them, and Stage 2 asks the question — four more
Indexable surfaces, each needing the same header, the same closing ask and the
same footer.

The obvious reading of "five Pages" is five copies of the prototype. It is the
reading that costs the most and fails the quietest. `datawego-company-site.html`
is 118KB, of which 91KB is not any one Page's prose; four new copies would put
that 91KB in the repository five times, so a footer edit is five edits with four
opportunities to forget one. Worse, each copy carries its own `var NL`: the
dictionary stops being build input and becomes five dictionaries, which is the
exact failure ADR 0003 exists to prevent — a string translated in one file and
not in another, both of them shipping. And U9's own requirement is that the
navigation come from the route table on all ten addresses, which five copies of
a hand-written header cannot do in one change.

We decided: **one whole document and four Bodies.** The home Page source keeps
its double job — it is the file a person opens to see the site, and it is the
chrome the build lifts. The other four Pages are authored as sections only
(`src/pages/<route key>.html`), and `src/site/chrome.mjs` splices each Body into
the document where the home Page's own sections used to be, then replaces the
document's navigation with the route table's four links. Nothing re-authors the
chrome: the head, the contact section and the footer move verbatim, which is why
this is composition rather than a templating system.

Rejected: four more whole documents, at the cost above. Also rejected, and
quickly, markers of any kind in the source (`<!-- chrome:start -->`): the
document is the one file in this repository a designer edits by hand, and a
comment whose only job is to be found by a build is a comment that gets tidied
away. The anchors are strings the document already has to contain — its `<main`,
its section-9 comment, its `<nav id="primary-nav">` — and each is refused if it
appears twice.

Consequences:

- The prototype's anatomy now lives in `chrome.mjs` as literals, and a source
  that moves one fails the build naming the string it could no longer find
  (R15). Deleting the home Page's contact section is deleting the edge of every
  Page's chrome, and says so.
- A Body writes `{{PAGE_NAME}}` rather than its own heading, because the route
  table owns the names that go in addresses (ADR 0005) and a heading typed twice
  is a claim made twice.
- An in-page anchor whose target this document does not have is rewritten to the
  home address plus its fragment. `#industries` used to mean the sixth section of
  the only page there was; with five Pages it would mean the sixth section of the
  one you are standing on, and a browser scrolls to an absent `id` without
  reporting anything. That is R7's and R19's failure — a broken address nobody is
  told about — in a form no curl line catches.
- The chrome's own words go through the dictionary like any other string, so
  `Talk to an engineer` stays a key in the document, and the navigation labels are
  the route table's `name`, which makes the table's names subject to
  `accountForEveryString`: a route named in English alone now fails the Dutch build.
- Composition happens before translation, so both variants of all five Pages are
  generated from the same two files, and the count of authored Page sources stays
  equal to the count of Pages.
