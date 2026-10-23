# www.datawego.nl is the host that answers; the other two are duplicates

The same page currently answers at three hosts, all HTTP 200 with byte-identical
bodies: `datawego.nl`, `www.datawego.nl`, and `datawego.pages.dev`. Ten addresses
turn that into thirty URLs (ADR 0001, ADR 0002), so the choice is made here
rather than left to whichever host a crawler happened to meet first.

We decided **`https://www.datawego.nl`** is the canonical host. Two layers, no new
infrastructure: the route table emits absolute `rel=canonical` values, which makes
every copy served from `datawego.pages.dev` declare itself a duplicate — the
cheapest possible fix, because it costs nothing and needs no header — and the
apex issues a 301 to www at the Pages custom-domain setting, which is what
`edmf.nl` already does and what fixes it for humans and inbound links.

Rejected: an `X-Robots-Tag: noindex` for the pages.dev copy. `_headers` applies to
a whole Pages project, not to one host, so a noindex written there noindexes the
canonical site too. Rejected as well: making the apex canonical with www
redirecting to it — defensible, one redirect shorter on the address printed on the
business card, but it moves against the pattern already proven in the sibling
project, and a host choice is not worth two conventions.

Also rejected: redirecting visitors to `/en/` by reading their browser language.
Google warns against it, and it shows a crawler two different languages from one
address, which is the one thing an `hreflang` table cannot survive. The root is
always Dutch; English is reached by a link and by `x-default`.
