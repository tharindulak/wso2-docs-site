# Map: WSO2 docs site on Docusaurus

Label: wayfinder:map

## Destination

A build-ready spec for the WSO2 docs site, plus a working site in this repo: Docusaurus themed with Oxygen UI, the hub as its home, every product on wso2.com/documentation pulled from its real content sources at Latest (decided 2026-10-07; API Platform added the same day; API Analytics stays on moesif.com), a deployment-option label on each page (no cloud/self-hosted toggle), GitLab-model versioning, and working search. Plan done by WSO2Con (2026-11-20).

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
- Product scope: every doc set on wso2.com/documentation, one entry per product covering all its deployment options (no separate SaaS/open-source entries, no "Cloud" sections). For WSO2Con every product is migrated at Latest only (user decision 2026-10-07, option (a) after the [Conversion survey](research/16-conversion-survey.md); API Platform added later that day once the Devant approach was built, so only API Analytics Platform links out, to moesif.com). See [Product catalogue](assets/product-catalogue.md) and [Coverage check](assets/documentation-coverage.md) (user decision 2026-10-07).
- Starting facts: [Initial facts](research/00-initial-facts.md). Oxygen UI is pre-1.0; Docusaurus advises fewer than 10 versions per docs instance.
- Treat findings as planning input for human review; flag security, licensing and supply-chain concerns for new dependencies.
- Identity Platform moves to a one-time migration instead of build-time conversion (user decision 2026-10-13): [Migrate Identity Platform docs (docs-is) to Docusaurus](../wso2-docs-is-migration/map.md).
- Every product publishes Docs bundles that the site pulls; every product migrates to Docusaurus eventually (no forced deadline), and until then its bundles carry raw MkDocs that the site still converts (user decisions 2026-10-14): [Roll out the WSO2 docs site across all products](../wso2-docs-rollout/map.md).
- Site features and content components (page feedback, llms.txt, steps, badges and the like) are planned on their own map: [Site features and content components for the WSO2 docs site](../wso2-docs-elements/map.md) (2026-10-12).

## Decisions so far

<!-- one line per closed ticket -->

- [How the existing WSO2 Docusaurus sites are built](issues/01-existing-docusaurus-sites.md): three single-instance sites with different search and hosting; Agent Manager's hand-forked "cloud" version is already drifting; hosting, theme CSS and CI checks are reusable.
- [Search options for a multi-product versioned Docusaurus site](issues/03-search-options.md): Algolia DocSearch likely free but discretionary and needs legal review; stock search is global, a swizzled SearchBar adds product scope; Typesense is plan B; local search ruled out.
- [Ways to pull content sources into one Docusaurus build](issues/02-pulling-content-sources.md): every approach must copy into Docusaurus's fixed versioned-docs layout; only commit SHAs pin docs-apim and docs-mi; unpinned pulls are a supply-chain risk; pinned fetch script recommended.
- [How Oxygen UI themes the docs site](issues/04-oxygen-ui-in-docusaurus.md): Oxygen look via Infima CSS variables plus plain MUI islands (193 KB vs 621 KB per page with the package); adopt the real package once it is tree-shakeable or ships tokens.
- [Content format for content sources](issues/06-content-format.md): teams keep MkDocs; the site converts and merges cloud and self-hosted at build time into labelled unified pages; shared text says "Identity Platform", self-hosted-only content "Identity Server".
- [How the docs site pulls content](issues/07-content-pull-mechanism.md): SHA lock file in the docs-site repo, hourly pull-based bump PRs that auto-merge on a green build; Latest = cloud + newest GA self-hosted; local override for writer preview.
- [Versioning details](issues/08-versioning-details.md): Latest plus 2 previous releases per self-hosted distribution, older ones linked on current sites; `/identity/7.2.0/…` URLs; Integration Platform gets one versioned section per distribution; new releases detected automatically, promotion PR needs docs-team approval.
- [Build-time conversion contract](issues/13-conversion-contract.md): written syntax spec, HTML allow-list (no scripts or handlers), failing pages block the bump with a shrinking exclude list for onboarding, check shipped as Action and CLI, numeric version compare; docs-site team owns the converter.
- [Deployment-option label](issues/09-deployment-option-label.md): GitLab-style "Deployment options" box under the title, labelled callouts for one-option content, both values shown inline; set per page in front matter with section defaults.
- [Navigation across hub and products](issues/10-navigation.md): HashiCorp model with a Products mega-menu, per-product second bar with section tabs and version selector; product names open an overview page; hub appears as "Account and billing"; provisional on the product catalogue.
- [Measure conversion of every product's docs](issues/16-measure-conversion-all-products.md): 92% of 6,617 Latest pages across 16 sources compile clean; failures are mostly invalid HTML in MI, IS and APIM; single-source products are cheap to bring in.
- [Search choice and behaviour](issues/11-search-choice.md): search starts scoped to the current product (whole product, Latest plus the viewed version) with an "All products" tab; hub pages in every scope; optional deployment-option filter; modal plus results page; re-index per deploy; skeleton uses self-hosted Typesense while the Algolia legal review is on hold.

## Not yet specified

- Redirects from current docs URLs (wso2.com docs, Asgardeo, Devant) to the docs site.
- Contribution workflow for product teams: pull-request previews in content repos (needs hosting), reviews, ownership of shared pages.
- API reference rendering (OpenAPI) inside product sections.
- Build time and cost once all products and versions are in, including image storage (dedup or CDN instead of copying 250 to 640 MB of images per version).
- Internationalisation.

## Out of scope

- Publishing location and hosting (repo in the wso2 org, domain, approvals): set aside by the user.
- Writing new content.
- Older versions of newly migrated products: next cycle; "Older versions" links to the current sites.
- Fixing source HTML on exclude lists: owned by product teams; pages appear as lists shrink.
- Launching the site.
- Moving Moesif docs off moesif.com.
- Ask AI or other AI answers in search: sends reader questions to a third-party LLM service with unconfirmed retention; ruled out with [Search choice and behaviour](issues/11-search-choice.md) (2026-10-12).
