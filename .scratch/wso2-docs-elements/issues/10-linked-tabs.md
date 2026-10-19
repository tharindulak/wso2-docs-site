# Spec: keep linked tabs working

Parent: [map](../map.md)
Type: grilling
Status: closed
Assignee:
Blocked by:

## Question

Content sources that enable Material's `content.tabs.link` expect tabs with the same label to switch together across a page and the site; the converter gives tabs positional values (`tab-N`), so readers of the docs site lose that behaviour. How does the converter keep it: tab value from a normalised label, which `groupId` (per source, per site), only for sources that enable `content.tabs.link` or everywhere, and whether the choice persists across pages? Should this be a converter fix owned by [Build-time conversion contract](../../wso2-docs-site/issues/13-conversion-contract.md) rather than a WSO2Con candidate here?

## Answer

Moved 2026-10-13 to [Which tab label sets sync, and how](../../wso2-docs-is-components/issues/01-linked-tabs.md) on [Content components on Identity Platform](../../wso2-docs-is-components/map.md), which builds it as a site-build remark plugin.
