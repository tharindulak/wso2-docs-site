# Migration order criteria and the migration recipe

Parent: [map](../map.md)
Type: grilling
Status: open
Assignee:
Blocked by: [Open the migration PR on the fork](../../wso2-docs-is-migration/issues/11-open-fork-pr.md)

## Question

Every product migrates eventually, with no forced deadline ([Docs bundle spec](01-docs-bundle-spec.md), clarified in [Shared release Action](03-shared-release-action.md)). In what order do products migrate after Identity Platform, by what criteria (cloud and self-hosted merged content, a team wanting explicit components, conversion failure rate), and with what recipe?


Which parts of `migrate-docusaurus.mjs` and the Identity Platform pilot are product-specific (cloud and self-hosted merge, version folders on main, includes as partials, stacked duplicates), and what is the per-product migration checklist? Inputs: the 16 content sources and their layouts in [Inventory every published version](../../wso2-docs-site-versions/issues/02-version-inventory.md), failure causes in [Measure conversion of every product's docs](../../wso2-docs-site/issues/16-measure-conversion-all-products.md), and lessons from the pilot. Output: a reusable migration recipe, an effort estimate per product, and the sign-off checklist a team uses to approve [Cutover](../../../CONTEXT.md).
