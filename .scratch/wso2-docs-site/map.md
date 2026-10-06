# Map: WSO2 docs site on Docusaurus

Label: wayfinder:map

## Destination

A build-ready spec for the WSO2 docs site, plus a working skeleton in this repo: Docusaurus themed with Oxygen UI, the hub as its home, Identity Platform and Integration Platform pulled from their real content sources, a deployment-option label on each page (no cloud/self-hosted toggle), GitLab-model versioning, and working search. Plan done by WSO2Con (2026-11-20).

## Notes

- Domain: documentation platform. Vocabulary lives in [CONTEXT.md](../../CONTEXT.md); use its terms (Docs site, Hub, Product, Deployment option, Content source).
- This map builds as well as plans: the skeleton is part of the destination. Execution beyond the skeleton is handed off.
- Skills every session should consult: grilling, domain-modeling. Research tickets use research; prototype tickets use prototype.
- Reference models: [developer.hashicorp.com](https://developer.hashicorp.com/) for product navigation; GitLab docs for the per-page deployment-option block.
- Content stays federated: each product team keeps its content source repo.
- Versioning follows the GitLab model: Latest holds WSO2 Cloud plus the newest self-hosted release; older self-hosted releases are frozen snapshots.
- The hub's IA from [WSO2 Cloud hub documentation plan](../wso2-cloud-docs/map.md) becomes the docs site's home and cross-cutting sections.
- Skeleton lives in this repo (`Wso2-Cloud`) for now.
- Hand-off follow-up for the Oxygen UI team: tree-shakeable build or tokens package, fully specified ESM imports. See [How Oxygen UI themes the docs site](issues/04-oxygen-ui-in-docusaurus.md).
- Product scope and content sources: [Product catalogue](assets/product-catalogue.md).
- Starting facts: [Initial facts](research/00-initial-facts.md). Oxygen UI is pre-1.0; Docusaurus advises fewer than 10 versions per docs instance.
- Treat findings as planning input for human review; flag security, licensing and supply-chain concerns for new dependencies.

## Decisions so far

<!-- one line per closed ticket -->

- [How the existing WSO2 Docusaurus sites are built](issues/01-existing-docusaurus-sites.md): three single-instance sites with different search and hosting; Agent Manager's hand-forked "cloud" version is already drifting; hosting, theme CSS and CI checks are reusable.
- [Search options for a multi-product versioned Docusaurus site](issues/03-search-options.md): Algolia DocSearch likely free but discretionary and needs legal review; stock search is global, a swizzled SearchBar adds product scope; Typesense is plan B; local search ruled out.
- [Ways to pull content sources into one Docusaurus build](issues/02-pulling-content-sources.md): every approach must copy into Docusaurus's fixed versioned-docs layout; only commit SHAs pin docs-apim and docs-mi; unpinned pulls are a supply-chain risk; pinned fetch script recommended.
- [How Oxygen UI themes the docs site](issues/04-oxygen-ui-in-docusaurus.md): Oxygen look via Infima CSS variables plus plain MUI islands (193 KB vs 621 KB per page with the package); adopt the real package once it is tree-shakeable or ships tokens.

## Not yet specified

- Redirects from current docs URLs (wso2.com docs, Asgardeo, Devant) to the docs site.
- Contribution workflow for product teams: previews, reviews, ownership of shared pages.
- API reference rendering (OpenAPI) inside product sections.
- Build time and cost once all products and versions are in.
- Internationalisation.

## Out of scope

- Publishing location and hosting (repo in the wso2 org, domain, approvals): set aside by the user.
- Writing new content.
- Migrating API Platform, Agent Manager and API Analytics Platform content beyond the plan.
- Products marked "later" in the [Product catalogue](assets/product-catalogue.md): APK, API Microgateway, Streaming Integrator.
- Launching the site.
- Moving Moesif docs off moesif.com.
