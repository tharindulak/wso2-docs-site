# Build the docs site skeleton

Parent: [map](../map.md)
Type: task (AFK)
Status: open
Assignee:
Blocked by: 05, 11, 15

## Question

Build the skeleton the destination names, from the decisions on this map, as production-quality code (not from the prototypes, which were written under prototype constraints): Docusaurus 3.10.2 in this repo; Oxygen look via Infima variables plus `@mui/material` islands ([How Oxygen UI themes the docs site](04-oxygen-ui-in-docusaurus.md)); hub home and product overview pages; HashiCorp-style navigation ([Navigation across hub and products](10-navigation.md)); Identity Platform and Integration Platform pulled through the SHA lock file and bump bot ([How the docs site pulls content](07-content-pull-mechanism.md)), converted at build time under the [Build-time conversion contract](13-conversion-contract.md); deployment-option label ([Deployment-option label](09-deployment-option-label.md)); versions per [Versioning details](08-versioning-details.md); search per [Search choice and behaviour](11-search-choice.md). Done when it builds in CI from pinned sources and a reviewer can walk the navigation, switch versions and search. Resolution records what was built and where.
