# 03 Search options for a multi-product versioned Docusaurus site (researched 2026-10-06)

Answers [issue 03](../issues/03-search-options.md). Builds on [Initial facts](./00-initial-facts.md) §2(c).

Sources: official docs and terms pages (fetched 2026-10-06), source code on GitHub via `gh`, npm registry. **[inference]** marks my reasoning; **[unverified]** marks claims not confirmed in a primary source. API keys found in WSO2 repos are masked and not reproduced here.

## TL;DR

- **Algolia DocSearch (free) looks available to the docs site** under the current terms. They target "developer documentation and technical blogs on publicly available websites" and do not exclude commercial companies. Acceptance is still at Algolia's "sole discretion". The limits are generous: 5M records, 50M searches a month, 20 indices, **one application**. Conditions: the "Search by Algolia" logo must stay, there is no support, and the site is auto-enrolled in Algolia's **DocSearchMCP**, which licenses the crawled content to Algolia for AI tools.
- **WSO2 already uses Algolia on Docusaurus.** wso2/docs-agent-platform has an Algolia config, Ask AI and a swizzled SearchBar with a lunr fallback. Lunr was made the default on 2026-09-27. wso2-enterprise/identity-platform-cloud (private) uses `@docsearch/docusaurus-adapter` with its own index. No Typesense use was found.
- **Typesense** is a credible self-hosted fallback with the same Docusaurus contextual-search model. It costs ops time: a 3-node HA cluster plus a scraper job in CI. The server is GPL-3.0.
- **Product and version scoping, HashiCorp style:** the default Docusaurus contextual search is already global, because it ORs a tag for every docs instance. Each product is pinned to its active, preferred or latest version. "This product only" needs a small swizzled SearchBar that narrows the tag filter to the active plugin's tag. Both Algolia and Typesense support this the same way.
- **Local search** (`@easyops-cn/docusaurus-search-local`) does not fit. Issue #544 (multi-instance + versions breaks search except latest) is still open with 0 comments.

## 1. Algolia DocSearch

### Eligibility

- Who can apply: "Open to developer documentation and technical blogs ... We offer the free DocSearch program to public technical documentation and technical blogs. We usually turn down applications when they are not production ready or have non-technical content on the website." Validation is automated, with a 1–2 business-day manual review if needed. Domain ownership must be verified within 7 days of approval. https://docsearch.algolia.com/docs/who-can-apply/
- Terms (effective 2026-07-24): "a free service available for indexing developer documentation and technical blogs on publicly available websites ... Algolia reserves the right to accept or reject applications ... in its sole discretion." Neither page excludes commercial vendors. https://www.algolia.com/policies/docsearch-plan-specific-terms
- **Conflicting wording:** the program FAQ still says "Search infrastructure can be costly for open source projects, so the DocSearch program is free" and "The free DocSearch program crawls only documentation pages for open source projects and technical blogs." https://docsearch.algolia.com/docs/docsearch-program/ . The binding terms say "developer documentation" without an open-source condition. **[inference]** The terms govern, so WSO2's public product docs qualify, but approval is not guaranteed. Marketing pages on the same domain (pricing, product pages) must stay out of the crawl.
- **One application per project:** "Use one Algolia application per project. Apply to the DocSearch program for each additional project." (FAQ). The terms allow "a maximum of one (1) application for the DocSearch Plan". **[inference]** A single unified docs site is one project. Separate per-product apps would conflict with this, so plan one index for the whole site. That matches how Docusaurus contextual search is designed.

### Limits (terms)

| Item | Limit |
|---|---|
| Records | 5,000,000 |
| Search requests | 50,000,000 / month |
| Resources crawled | 5,000,000 / month |
| Record size | 100 KB |
| Data per app / per index | 25 GB |
| Indices | 20 |
| Applications | 1 |

Exceeding a limit lets Algolia "degrade or suspend" the app. "Algolia does not provide support for the DocSearch plan. Algolia may terminate the DocSearch plan at its sole discretion." Inactivity over 30 days may remove data. The program FAQ also says "Free plans can hold up to 10,000 records". **[inference]** That figure appears to describe the general Algolia Free plan used when you run DocSearch yourself, not the DocSearch Plan, but the wording is ambiguous. Confirm with Algolia.

**Sizing [unverified estimate]:** the Docusaurus template creates one record per heading/paragraph group (`aggregateContent: true`). Even 5 products × ~10 versions × ~1,000 pages × ~30 records ≈ 1.5M records, under 5M. To save headroom, index only supported versions (see §4).

### Obligations and data rights

- The logo is mandatory: "Place Algolia's logo, which links back to Algolia.com, in a visible place ... on the search box or in the autocomplete panel". Removing it makes the site ineligible.
- **DocSearchMCP (new in the 2026-07-24 terms):** "An Algolia DocSearch Plan includes automatic enrollment in Algolia DocSearchMCP ... Subscriber hereby grants Algolia and its Affiliates a worldwide, nonexclusive, revocable, transferable, sublicensable, royalty-free and limited license to crawl Subscriber's website(s), index Subscriber's developer documentation ... and use such data to provide the DocSearchMCP service." **Legal review needed.** This grants a sublicensable licence over WSO2 docs content to a third party for AI tooling. The content is public, so the risk may be low, but making that call is for WSO2 legal, not this note.
- The DocSearch plan is a "Free Service" under the Algolia Terms of Service (https://www.algolia.com/policies/terms/). **[unverified]** Whether a DPA or SLA applies to free services was not checked.

### If not eligible (paid Algolia)

- From https://www.algolia.com/pricing (fetched 2026-10-06): Free plan 10K searches/month, 50K records, 5K crawls/month. Grow: 10K searches + 100K records included, then "$0.50 per additional 1K search requests" and "$0.40 per additional 1K records". Crawls: 10,000/month included on Grow, then "$0.80 per additional 1K Crawls/mo". Elevate is custom pricing.
- **[unverified]** Actual WSO2 monthly cost depends on traffic. Current docs search volumes were not available, so no estimate is given.

### Docusaurus integration

- `@docusaurus/theme-search-algolia` (3.10.2, bundled with the classic preset) uses the `themeConfig.algolia` options `contextualSearch` (default `true`), `searchParameters.facetFilters` (merged with contextual filters), `externalUrlRegex`, `replaceSearchResultPathname`, `insights` (default `false`) and `askAi`. https://docusaurus.io/docs/search
- Docusaurus requires the official "Docusaurus v3 crawler configuration". The template's `initialIndexSettings.attributesForFaceting` is `['type','lang','language','version','docusaurus_tag']`, and it crawls from `sitemap.xml`. https://docsearch.algolia.com/docs/templates/
- **New:** `@docsearch/docusaurus-adapter` (npm 5.1.2, MIT, from algolia/docsearch) is configured under `themeConfig.docsearch` with `indices: [...]` (several indices queried in order, per-index `searchParameters`), `contextualSearch` (default `true`), `insights` and the Ask AI side panel. https://github.com/algolia/docsearch/blob/main/packages/website/docs/packages/docusaurus-adapter/configuration-reference.mdx . identity-platform-cloud already uses it.

## 2. Typesense (self-hosted or Typesense Cloud)

- **Components:** the `typesense-docsearch-scraper` Docker image (fork of Algolia's legacy scraper; LICENSE is MIT, "Copyright (c) 2014 Algolia") and `docusaurus-theme-search-typesense`. The theme is v0.27.0 (2026-08-26, MIT, 84 stars, 13 open issues), supports Docusaurus `>=3.9.0 <4.0.0`, and is "a fork of ... @docusaurus/theme-search-algolia". https://github.com/typesense/docusaurus-theme-search-typesense , https://typesense.org/docs/guide/docsearch.html
- **Server:** typesense/typesense is **GPL-3.0**, latest v30.2 (2026-04-19). **[inference]** Running it unmodified as a separate service is normally fine for GPL. Still, check against WSO2's OSS policy (WSO2 ships Apache-2.0).
- **Contextual search:** `useTypesenseContextualFilters()` builds `language:=<locale> && docusaurus_tag:=[<tags>]` from Docusaurus `useContextualSearchFilters()`. That gives the same per-instance/version tag model as Algolia (source: `src/client/useTypesenseContextualFacetFilters.ts`). `useContextualSearchFilters` was "restore[d] ... for retrocompatibility" in Docusaurus (CHANGELOG, PR #10397). **[inference]** It may break at Docusaurus v4, and the theme already caps support at `<4.0.0`.
- **Ops (self-host):** "We strongly recommend that you run a Highly-Available 3-node or 5-node configuration in your Production environment" (Raft). RAM is about 2–3× the searchable dataset size, with a minimum of 2 vCPUs. https://typesense.org/docs/guide/system-requirements.html . The scraper is stateless and is meant to run in CI after each deploy. **[inference]** It could run on WSO2's existing platform, for example as a Choreo/OpenChoreo scheduled job plus a 3-node StatefulSet. WSO2 would then own upgrades, backups, scaling and on-call.
- **Typesense Cloud:** hourly pricing by RAM/vCPU, plus bandwidth and an HA multiplier. The pricing page shows a calculator rather than list prices. **Prices unverified.** https://cloud.typesense.org/pricing
- **Pros vs Algolia:** no logo requirement, no third-party content licence, and full control of data residency and query logs. **Cons:** ops burden, single-team ownership (a single point of failure if the cluster or scraper breaks), a smaller community theme, and no equivalent to Algolia's hosted crawler or Ask AI out of the box. Typesense does offer optional semantic search (https://typesense.org/docs/guide/docsearch.html).

## 3. Local search plugins (for comparison)

- `@easyops-cn/docusaurus-search-local` v0.55.3 (2026-07-29). Issue #544, "Multi project versioning search not working" (open, opened 2025-11-23, 0 comments), says: "if using a multi project setup with additionally multiple versions then search will be unavailable for all versions except latest version." Issue #304, "multiple versioned docs", is open (last activity 2023-12). https://github.com/easyops-cn/docusaurus-search-local/issues/544 , https://github.com/easyops-cn/docusaurus-search-local/issues/304
- `docusaurus-lunr-search` 3.6.0, last published 2025-01-10. Like other local plugins it ships the index to the browser. Docusaurus recommends local search "where the search index is small" (https://docusaurus.io/docs/search#using-local-search). **[inference]** That does not hold for 5 products × many versions.
- Local search's only real merit is that no query leaves the browser. It is a reasonable **fallback** when the hosted engine is down, as agent-platform does.

## 4. Scoping to product and version, with global search (HashiCorp style)

How Docusaurus does it (verified in source):

- Each docs page carries a tag `docs-${pluginId}-${versionName}` (`packages/docusaurus-plugin-content-docs/src/client/docsSearch.ts`).
- `useDocsContextualSearchTags()` returns **one tag per docs instance**. For the instance being browsed it uses the active version. For every other instance it uses the user's preferred version, else the latest. In the source's words: "If user is browsing Android 1.4 docs, he'll get presented with: Android '1.4' docs; iOS 'preferred | latest' docs".
- Algolia turns that into `[language:<locale>, [docusaurus_tag:default, docusaurus_tag:docs-a-x, docusaurus_tag:docs-b-y, ...]]`, where the inner array is an OR (`useAlgoliaContextualFacetFilters.ts`). Typesense does the same with `docusaurus_tag:=[...]`.

So, with one docs instance per product:

| Mode | Filter | How |
|---|---|---|
| **Global (default)** | every product, each at its active/preferred/latest version, plus unversioned pages (hub, `default` tag) | out of the box, `contextualSearch: true` |
| **This product, this version** | only `docusaurus_tag:docs-<activePluginId>-<activeVersion>` (optionally plus `default` for hub pages) | swizzle `SearchBar` and use `useActivePluginAndVersion()` from `@docusaurus/plugin-content-docs/client` to narrow the tag list; offer a toggle or tabs ("This product" / "All products") **[inference: design, not an existing feature]** |
| **Older versions of other products** | not shown by default | intended. A user can set a preferred version via the version dropdown |

Supporting points:

- **Swizzling precedent:** HashiCorp pre-applies the current product tag and removes it for global search (Initial facts §3, inferred from code). WSO2 agent-platform already swizzles `SearchBar` and imports `useAlgoliaContextualFacetFilters` and `mergeFacetFilters` from `@docusaurus/theme-search-algolia/client`, so the hooks needed are public.
- **Result labelling [inference]:** the Docusaurus v3 crawler template sets `lvl0` to navbar title + breadcrumbs. Product names will show in result groups only if the navbar active item or breadcrumbs carry the product name, so check the navbar design.
- **Cloud pseudo-version:** if products model cloud as a version (as agent-platform's `versions.json = ["v1.0.0","cloud"]` does), the active/preferred logic treats it like any other version. No special handling is needed **[inference]**.
- **Index fewer versions:** keep unsupported versions out of the sitemap or crawler `pathsToMatch`, or noindex them, to reduce records and stale hits. Agent-platform already excludes `next` from lunr.
- **Pitfall:** if the index lacks the facet attributes, search returns nothing while contextual search is on. The fix is to recreate the index with the official template. https://docusaurus.io/docs/search#algolia-no-search-results

## 5. Existing WSO2 usage (gh code search, 2026-10-06)

- **wso2/docs-agent-platform** (public), `docusaurus.config.ts`:
  - `themeConfig.algolia` with `indexName: 'Agent Manager Documentation Site (Docusaurus)'`, `contextualSearch: true`, `replaceSearchResultPathname` and `askAi.assistantId` (appId/apiKey masked here).
  - Also `docusaurus-lunr-search` (excluding `next`) and `customFields.searchProvider: 'lunr'`.
  - `src/theme/Navbar/Content/index.tsx` probes Algolia reachability and falls back to lunr, caching the choice in localStorage.
  - Commit 2026-09-27: "make lunr the default search provider". The reason is not stated **[unverified why]**.
  - Note: the probe calls `/1/indexes` with the search key. **[inference]** On a search-only key scoped to one index this may return 403, which would always select lunr. Worth checking.
- **wso2-enterprise/identity-platform-cloud** (private), `documentation/docs/docusaurus.config.ts`:
  - `@docsearch/docusaurus-adapter`, `themeConfig.docsearch` with `indexName: 'identity-platform-cloud-docs'`, key masked.
  - Comment: "No askAi: it needs a second, markdown-derived index that only the Algolia crawler builds, and the crawler cannot reach this site until it is live."
  - Its hosting plan (`.claude/design/docs/docs-hosting-plan-openchoreo.md`) lists "U4 provision our own Algolia application" and notes that the CSP must allow Algolia.
- **wso2-enterprise/api-content-hub, iam-content-hub:** `algolia` appears only in `custom.css`. The search setup was not inspected.
- **Typesense:** no hits in `org:wso2`.
- **[inference]** WSO2 teams are each provisioning their own Algolia app. DocSearch allows one application per project, so the unified site should consolidate into **one** application and index, owned by the docs-site team. Several DocSearch apps for one site could be seen as breaching the one-app limit.

## 6. Data privacy and compliance

- **Queries go to a third party (Algolia or Typesense Cloud):** each keystroke is sent from the reader's browser to the provider's servers, along with IP and user agent. DocSearch data is hosted "on Algolia servers with replicas around the world" (program FAQ). **[unverified]** Region pinning is not offered on the free plan. This is relevant for EU readers (GDPR) and WSO2's cross-border transfer rules. Reference the provider in the WSO2 privacy notice and cookie banner.
- **Analytics:** Algolia keeps search analytics ("analyze anonymized searches") in the dashboard. `insights` is off by default in Docusaurus. If enabled, Search Insights v2 creates an anonymous token per page load. The `_ALGOLIA` cookie (6-month lifetime) is used only when `useCookie: true`, and Algolia advises: "Legal requirements like GDPR may prohibit non-essential cookies without consent. If so, leave the `useCookie` parameter as `false`." https://www.algolia.com/doc/guides/sending-events/concepts/usertoken/ . Tie any enabling to CookiePro consent, which WSO2 docs sites already load.
- **Ask AI:** it sends reader questions to Algolia's AI service (Agent Studio). **[unverified]** The LLM provider, data retention and whether it is free on DocSearch were not confirmed (the v4 Ask AI docs page now returns 404). Needs privacy review before enabling.
- **DocSearchMCP licence:** see §1. Needs legal review.
- **API keys:** the DocSearch key is "a search-only API key, so you can share it publicly" (program FAQ). Never commit an Admin/write key, and keep crawler or Typesense admin keys in CI secrets. For self-hosted Typesense, issue a search-only scoped key to the browser.
- **CSP:** allow-list the provider hosts explicitly (e.g. `*-dsn.algolia.net` **[unverified exact hosts]**) rather than using wildcards.
- **Self-hosted Typesense** keeps queries and logs in WSO2 infrastructure, which simplifies privacy but moves security patching and availability onto WSO2.

## 7. Recommendation (for human review)

1. Apply for **one** DocSearch application for the unified docs site. First get legal sign-off on the DocSearchMCP licence and the logo requirement, and privacy sign-off on query and analytics flows.
2. Use the stock contextual search for global search, and swizzle `SearchBar` to add a "This product" scope. Index supported versions only.
3. Keep a local-search fallback only if outages are a real concern, and fix the reachability probe first.
4. Keep Typesense (self-hosted, 3 nodes) as plan B if DocSearch is rejected, legal declines the licence, or data residency rules out Algolia. Compare its ops cost with paid Algolia Grow before choosing.

## Open questions

- Does Algolia accept a commercial vendor's multi-product site as one project? Ask Algolia before applying.
- Why did agent-platform switch to lunr on 2026-09-27?
- Ask AI: cost on DocSearch, LLM provider, retention.
- Expected query volume, to size paid Algolia or Typesense if needed.
