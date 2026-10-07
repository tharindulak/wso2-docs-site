# Build the docs site skeleton

Parent: [map](../map.md)
Type: task (AFK)
Status: open (in progress)
Assignee: tharinduj
Blocked by: 05, 11, 15

## Question

Build the skeleton the destination names, from the decisions on this map, as production-quality code (not from the prototypes, which were written under prototype constraints): Docusaurus 3.10.2 in this repo; Oxygen look via Infima variables plus `@mui/material` islands ([How Oxygen UI themes the docs site](04-oxygen-ui-in-docusaurus.md)); hub home and product overview pages; HashiCorp-style navigation ([Navigation across hub and products](10-navigation.md)); every product except API Platform (see [Product catalogue](../assets/product-catalogue.md), status WSO2Con), at Latest, pulled through the SHA lock file and bump bot ([How the docs site pulls content](07-content-pull-mechanism.md)), converted at build time under the [Build-time conversion contract](13-conversion-contract.md); deployment-option label ([Deployment-option label](09-deployment-option-label.md)); versions per [Versioning details](08-versioning-details.md); search per [Search choice and behaviour](11-search-choice.md). Excluded pages redirect to their current-site URL. Done when it builds in CI from pinned sources and a reviewer can walk the navigation, switch versions and search. Resolution records what was built and where.

## Progress (2026-10-07)

Started at the user's request ahead of tickets 05, 11 and 15, on branch `docs-site-build`, folder `docs-site/` (see its README).

Done:
- Converter rewritten as production code with 27 unit tests: allow-listed Jinja (never evaluated), numeric version compare, includes confined to the source (`{% include %}`, `{!file!}`, `--8<--`, `{{#var#}}`), HTML allow-list with literal-only quick-start metadata, MkDocs-to-MDX syntax, cloud/self-hosted merge, sidebars from MkDocs `nav:` (merged for Identity).
- `content-sources.yaml` pins 8 sections (Identity, Agent Manager self-hosted v1.0.0, Kubernetes Gateway, Developer Platform x2, Healthcare, Financial Services, Updates, Platform Security) to full SHAs with tracked branches; 172 pages on exclude lists (Identity 116).
- Fetch (validated, shell-free, sparse, exact commit), content build (redirects for excluded pages; lists only shrink), bump bot (tested promotion on a 7.2.0 lock copy), check-source CLI and composite Action, CI / hourly bump / daily promotion workflows (actions pinned by SHA).
- Docusaurus site: Oxygen look, Products mega-menu, product bar with tabs and version selector, deployment-option box, Applies/DeploymentValue, Account and billing, search placeholder. Navbar customises contents only (keeps `.navbar` and the mobile sidebar).

Found while building:
- Agent Manager also keeps cloud docs as a separate tree (`versioned_docs/version-cloud`); only its self-hosted v1.0.0 is in. Added to [Combining separate cloud and self-hosted doc sets](15-combine-separate-doc-sets.md).
- The converter's MDX compile check is weaker than the Docusaurus build (link and image processing); CI's full build is the final gate.
- `npm audit`: advisories in Docusaurus 3.10.2 build-time dependencies (tinypool, serialize-javascript and others). Static output; needs security review and `overrides`.
- Workflows are untested: this repository has no GitHub remote yet (hosting is out of scope).

Full build (2026-10-07): with images, 2,396 pages across 8 sections build; verified in a browser (home, Identity merged page with version selector and MkDocs-titled sidebar, Agent Manager, an excluded page redirecting to wso2.com with canonical and noindex). Open issues from the build:
- 138 broken internal links and 203 broken anchors. Of 74 distinct broken Identity targets, 23 are dead in the source itself; the rest are conversion gaps (heading IDs differ between MkDocs and Docusaurus; some relative links). Next: emit MkDocs-style heading IDs, and report source-side dead links to teams.
- 178 Identity API reference pages render as text: [Render API references](17-api-reference-rendering.md).
- Build output is 1.9 GB (images copied twice per section); see "Build time and cost" in the map.

Remaining: Integration Platform (after ticket 15), real search (after ticket 11), hub page content (hub owners).
