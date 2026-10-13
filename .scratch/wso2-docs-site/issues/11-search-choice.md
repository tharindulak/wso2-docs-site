# Search choice and behaviour

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharindulak
Blocked by: 03, 08 (12 on hold: engine choice deferred, behaviour decided now; user decision 2026-10-12)

## Question

Which search engine does the docs site use, and how does search behave: default scope (current product and version, or everything), filters shown, and how hub pages appear in results?

## Answer

Decided with the user, 2026-10-12. The legal review of Algolia DocSearch terms is on hold, so this settles behaviour, which is the same on Algolia and Typesense; the production engine moves to [Production search engine](17-production-search-engine.md).

**Fact found first:** the skeleton runs one docs plugin instance per *version* (`docs-site/site/docusaurus.config.js`, `id: v.id`), and older versions build as separate snapshots. Stock contextual search would therefore OR every version of every product. Scoping needs a site-owned tag filter (swizzled SearchBar) whichever engine is used.

- **Default scope:** on a product page, search starts scoped to that product, with tabs "<Product name>" | "All products" in the modal and results page. The choice lasts for that search only; nothing is stored. Home and hub pages search all products.
- **"This product"** means the whole product (every section, for example WSO2 Integrator and Micro Integrator together); results show their section.
- **Versions searched:** Latest of every product, plus the version being viewed when on an older version of that product.
- **Account and billing (hub) pages** appear in every scope, labelled "Account and billing".
- **Deployment-option filter:** optional, off by default; pages labelled with several options match each.
- **UI:** Ctrl/Cmd+K modal plus a full results page ("See all results") that holds the filters.
- **Results:** grouped by product (current product, Account and billing, then others); title, matched heading, snippet, "Section · Version" (version only when not Latest), deployment badges only when the page is not labelled with every option.
- **Indexed:** Latest and the 2 kept versions of every migrated product, the hub, product overview pages, and one static record per link-out product ("Docs for X are on <site> ↗"). Not indexed: exclude-listed pages, the home page, older versions on MkDocs sites, 404 and redirect stubs.
- **Index updates:** re-index after every deploy as a CI step; admin key in CI secrets, search-only key in the browser.
- **Analytics:** aggregate query and no-results counts kept server-side; no cookies or per-reader tokens. Privacy to confirm before production.
- **Outage:** "Search is unavailable right now", the Products menu, and a link running the query on a site-restricted web search engine. No local-index fallback.
- **Engine for the skeleton:** self-hosted Typesense in Docker (same Docusaurus filter model, no third-party content licence, queries stay in-house). Check the Typesense server's GPL-3.0 licence against WSO2's OSS policy before any use beyond dev.
- **Ask AI:** out of scope for this map.

## Built (2026-10-12, committed on branch docs-site-search: d753095)

In `docs-site/`: `scripts/search-index.mjs` (indexer), `site/src/lib/search.mjs` (filters, grouping), `site/src/components/search/` (Ctrl/Cmd+K dialog), `site/src/pages/search.js` (results page with deployment filter), `search/compose.yaml` (local Typesense 30.2, pinned by digest). Verified against local Typesense: 134,527 records from the merged build, indexed in about a minute; queries 10 to 60 ms; search key limited to searching `docs`; analytics rules on the alias. Changes found while testing: results ranked in 10 relevance buckets, then page before section; a heading repeated on one page shows once; single-section products show no section label. Open: the `/search` page logs a recoverable React hydration warning (#418).

Follow-up (2026-10-13): full site built with all 33 older versions (snapshots about 1 minute each locally); 134,888 records indexed, version scope checked from Identity 7.2.0 and 5.11.0, Micro Integrator 4.5.0, API Manager 4.6.0 and Kubernetes Gateway 1.1.0. API Manager 4.0.0 to 4.3.0 needed the converter to write MkDocs redirect_maps pages (bace285). Open: in "All products", a strong match elsewhere can push the reader's own product off the first screen (API Manager 4.6.0, "rate limiting"); a small boost for the current product would fix it.
