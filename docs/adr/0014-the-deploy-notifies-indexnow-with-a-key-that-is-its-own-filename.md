# IndexNow is notified by the deploy, with a key that is its own filename

The plan took the site as far as the two dashboards: Google holds the sitemap and
ten indexing requests (row ④), Bing holds the issued auth file and its own copy of
that sitemap (row ⑤). Both then decide for themselves when to come back, and the
IndexNow FAQ states the wait plainly — without a ping, "it can take days to weeks
for search engines to discover that the content has changed". This site does
change: every deploy rewrites ten addresses that nobody has linked yet.

We decided: **the deploy says so.** One POST to the IndexNow hub naming the host,
a key and the addresses that just became true, and the engines sharing the hub fan
it out. Their roster is indexnow.org's own sentence — IndexNow "has support from
Microsoft Bing, Naver, Seznam.cz, Yandex, Yep", with an Amazon endpoint in the FAQ
alongside the global one. **Google is on neither list, and the word appears in the
FAQ zero times.** So IndexNow is not a faster Google. It is the route into the Bing
index, which is also the one ChatGPT retrieval leans on (ADR 0007 welcomes those
crawlers), plus four indexes this repository had never told anything about itself.

The route not taken is Cloudflare's, and it deserves recording because it is real
and it is abandoned at the same time. The FAQ still says "Cloudflare offers native
IndexNow integration", and the 2021 announcement is live: switching on **Crawler
Hints** — "with the simple click of a button" — made Cloudflare send these same
pings for you, tested with Bing and Yandex. Everything that would let a stranger
press that button knowingly is gone: the Crawler Hints docs page 404s at all five
addresses it could live at, the docs product index names neither Crawler Hints nor
IndexNow, and the changelog's current page carries the word zero times. What the
integration is on this zone tonight is not knowable from here — the token can list
the zone, and answers `Unauthorized to access requested resource` for every zone
setting. So this is rows ② and ⑥ decided the same way again: an undocumented
control is not a load-bearing one, and a mechanism whose source sits beside the
thing it notifies beats one that fires when somebody remembers to switch it on.

The protocol is one string and one file. A key is 8 to 128 characters of `a-z`,
`A-Z`, `0-9` and hyphens; it is published as `{key}.txt` at the root of the host
being notified, and the file's entire content is that string — the FAQ's own check
is "the file loads and displays only your key". The build owns both halves:
`src/indexnow.key` is the one place the string is written, and `static.mjs` carries
it into the name *and* the bytes of the root file, which takes the roster from 32
files to 33. That shape is the decision. A deploy that can notify over a key nobody
is hosting is the failure it prevents, and the guard refuses a key outside that
alphabet, so the file an engine fetches cannot be missing while the POST that names
it succeeds. Rotating is the same string moved: edit `src/indexnow.key`, rebuild —
the old root file disappears because the build is the only writer of `dist/` (ADR
0003) — and the engines re-verify against the new file at the next submission,
which is the FAQ's own rotation procedure rather than this repository inventing one.

Consequences:

- `deploy.js` grew a third step, and it is deliberately non-fatal. Pages has
  accepted the upload by then, so a network that refuses a POST to
  `api.indexnow.org` prints a warning carrying the retry command instead of turning
  a successful deploy into a failed one.
- `tools/indexnow.mjs` reads `dist/sitemap.xml` rather than keeping a list of its
  own, so what a notification claims and what the deployment serves are the same
  ten strings by construction (R6). It refuses a sitemap naming more than one host,
  because a key is checked on the notified host only and ADR 0006 made www that host.
- Ten URLs against a documented cap of 10,000 per request means every deploy
  notifies the whole site, which is the bulk case the FAQ allows for a site that
  just changed. The sitemap stays the inventory and this stays the change-ping;
  nothing here replaces row ④.
- The key is public by instruction, not by accident, and sits in the same
  category as the Search Console TXT token and Bing's `<user>` code: a lookup an
  engine uses to confirm the host authorized a ping. Knowing it grants nothing, so
  it belongs in the repository where the deploy that uses it already is.
- Measured as served, 2026-10-25: `{key}.txt` answers 200 `text/plain`, 32 bytes,
  its body equal to the key — on www in 0 hops, on the apex behind ①'s single 301,
  and on the deployment alias. The first POST after that deploy answered **HTTP
  202**, which is the documented first answer while an engine fetches the key file;
  the same command eight seconds later answered **HTTP 200**.
