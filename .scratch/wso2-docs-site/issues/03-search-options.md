# Search options for a multi-product versioned Docusaurus site

Parent: [map](../map.md)
Type: research
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

Is Algolia DocSearch available to WSO2 (eligibility for a commercial company's public docs, limits, crawler config for multi-instance and versions), and how does self-hosted Typesense compare (cost, ops, Docusaurus integration)? For each, how can search be scoped to the current product and version, HashiCorp style, while still allowing global search? Note the local-search plugin's multi-instance versioning bug from [Initial facts](../research/00-initial-facts.md).

## Answer

Resolved by research, 2026-10-06. Full findings: [Search options](../research/03-search-options.md).

- Algolia DocSearch (free) likely covers WSO2's public docs, but acceptance is at Algolia's discretion. Limits: 5M records, 50M searches a month, 20 indices, one application per project, no support, "Search by Algolia" logo required.
- Legal flag: joining DocSearch auto-enrolls the site in DocSearchMCP, a sublicensable licence for Algolia to use crawled docs in AI tools. Needs legal review: [Legal review of Algolia DocSearch terms](12-docsearch-legal-review.md).
- WSO2 already uses Algolia in docs-agent-platform (switched off to lunr on 2026-09-27, reason unknown) and in a private identity-platform-cloud repo. The unified site should use one app and one index.
- Docusaurus contextual search is global by default (every product at its current or chosen version); a small swizzled SearchBar adds a "This product" scope. Works for Algolia and Typesense.
- Typesense is plan B: MIT Docusaurus theme, but the server is GPL-3.0 and self-hosting needs a 3-node cluster plus a CI scraper. Not used anywhere at WSO2 today.
- Local search ruled out: easyops issue #544 breaks multi-instance plus versions.
- Privacy: every keystroke goes to Algolia; keep Algolia analytics cookies off until the reader consents. Ask AI data handling is unverified.
