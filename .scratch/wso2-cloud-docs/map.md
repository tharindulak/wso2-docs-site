# Map: WSO2 Cloud hub documentation plan

Label: wayfinder:map

## Destination

A WSO2 Cloud hub documentation plan, ready to hand to writers: information architecture, page inventory, source of truth per cross-cutting fact, per-product gap list, and priority order, with the WSO2Con (2026-11-20) launch-critical pages marked.

## Notes

- Domain: documentation planning. Vocabulary lives in [CONTEXT.md](../../CONTEXT.md); use its terms (WSO2 Cloud, Product, Hub, Cross-cutting topic, Product docs, Deployment option, Primary reader).
- Skills every session should consult: grilling, domain-modeling. Research tickets use research.
- Primary readers: new customers onboarding, and customers of one product discovering the others.
- Hybrid model: the hub owns cross-cutting topics; everything else links to product docs.
- Scope covers SaaS, hybrid data planes and on-prem, but on-prem appears only as a "Deployment options" section per product page, linking out.
- Naming: new product names only; former names (Asgardeo, Bijira, Devant, Moesif) appear on a single "Product names" page.
- Ownership: the user's team owns the hub; each product's docs team keeps its product docs.
- Deadline: WSO2Con, 2026-11-20.
- Starting facts: [Initial landscape](research/00-initial-landscape.md).
- Treat all findings as planning input for human review; verify marketing claims (SLA, regions) with product teams before reuse.

## Decisions so far

<!-- one line per closed ticket -->

- [Where cross-cutting topics live today across the five product docs](issues/01-cross-cutting-topics-today.md): no shared layer; every topic is per product, with contradictions on organizations and regions, SLA stated only by Identity, four status pages and five support channels.
- [Gap audit for each product's docs](issues/02-product-gap-audit.md): blockers are dead entry links (Agent Manager docs, API Analytics page) and a stale docs hub; cloud getting-started is weak in Agent Manager, Integration and Moesif; former names and missing cross-product links are widespread.
- [What "WSO2 Cloud" means to a customer](issues/07-what-wso2-cloud-means.md): a SaaS family of five products under one WSO2 Cloud account, shipping before WSO2Con; hub frames it as an honest family with an account page plus fallback; nothing published about the account before launch or approval.
- [Hub information architecture](issues/04-hub-information-architecture.md): six task-based sections, hub owns account, org, SSO, billing, regions and trust pages; one template per product page; Moesif framed as "powered by Moesif". See [Hub site tree](assets/04-hub-site-tree.md).

## Not yet specified

- Navigation between the hub and product sites (shared header, back-links, cross-site search).
- Process for keeping the hub's cross-cutting facts current after launch.

## Out of scope

- Choreo / Engineering Platform: not a WSO2 Cloud product for this effort.
- Hub hosting, URL and tooling: deferred by the user; not decided in this map. Tooling (Docusaurus docs site) is now charted in [WSO2 docs site on Docusaurus](../wso2-docs-site/map.md).
- Internal enablement docs (sales, support).
- Writing the pages themselves.
- Moving product content into the hub.
- A standalone on-prem section.
- Gap fixes for the wso2.com/api-analytics-platform/ 404 and for Bijira former-name usage: dropped by the user; see [Gap audit for each product's docs](issues/02-product-gap-audit.md).
