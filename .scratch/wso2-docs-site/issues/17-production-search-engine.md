# Production search engine

Parent: [map](../map.md)
Type: grilling
Status: open
Assignee:
Blocked by: 12 (on hold)

## Question

Which engine serves search in production: Algolia DocSearch (one application for the whole site), paid Algolia, or Typesense (self-hosted 3-node or Typesense Cloud)? Inputs: the outcome of [Legal review of Algolia DocSearch terms](12-docsearch-legal-review.md), the Typesense server's GPL-3.0 licence checked against WSO2's OSS policy, privacy sign-off on query flows and the aggregate analytics decided in [Search choice and behaviour](11-search-choice.md), and Typesense ops cost compared with paid Algolia. Behaviour is already fixed and engine-independent; the skeleton runs on Typesense in Docker.

## Inputs found while building the skeleton (2026-10-12 to 13)

- Typesense restart: a node rebuilds its index by replaying its log (until its hourly snapshot), and its health check reports OK before the replay ends, so searches can return partial results for minutes. A single local node also stuck after coming back on a new internal address ("Node not ready yet"); `reset-peers-on-error` fixed it locally but can drop data, so production needs a 3-node cluster or Typesense Cloud and a readiness check, not that flag.
- Production configuration still to do: https endpoint, `TYPESENSE_CORS_DOMAINS` set to the site origin, admin and search keys as CI secrets, an index step after deploy (`npm run search-index -- <merged build>`), the Typesense host in the site's Content-Security-Policy `connect-src` (no wildcard).
- Privacy: Typesense groups one reader's keystrokes by client IP (in memory) for analytics; the outage fallback sends the query to DuckDuckGo.
- Size: about 135,000 records for Latest plus 33 older versions, about 350 MB of Typesense memory, indexed in about 1 to 2 minutes.
