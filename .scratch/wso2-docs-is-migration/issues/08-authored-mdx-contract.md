# Authored-MDX contract and CI check for docs-is

Parent: [map](../map.md)
Type: grilling
Status: open
Assignee:
Blocked by: 03

## Question

From [Locking down authored MDX](03-mdx-authoring-risks.md): decide the written contract for writers once docs-is is MDX (allowed components such as `<Applies>`, `<DeploymentValue>`, tabs, admonitions; allowed imports; expressions; raw HTML), what the CI check in the fork enforces and how it runs (pinned Action, same code as the docs-site build), and what the contributor guide in the PR covers (layout, versions, previewing through the docs site's local override). Settled already by [Docusaurus tree format decisions](12-tree-format-decisions.md): no imports except partials (components are global), JSON-only sidebars, relative `.md` links, no number prefixes, shared assets immutable, one remark plugin for check and build.

## Notes

- 2026-10-13 (from [Docs site reads Identity Platform from the fork](10-docs-site-reads-fork.md)): linked `.html` attachments (for example `sample-sso-redirect-page-template.html` in 5.9.0 to 5.11.0) are served from `docusaurus/static/` on the docs origin, so any script in them runs there. Same exposure as `mkdocs-merge` and the former site today, but after cutover writers add such files directly: decide whether the check rejects new `.html` under `static/`, or only allows them with no `<script>`, event handlers or `javascript:` URLs.
- 2026-10-14: the allowed WSO2 content components and the check that holds writers to them are decided on [Writers author with WSO2 content components](../../wso2-docs-authoring-components/map.md); this contract waits on its [How writers write each component](../../wso2-docs-authoring-components/issues/01-component-api.md) and hosts its check in the fork's CI.
- 2026-10-14: [How writers write each component](../../wso2-docs-authoring-components/issues/01-component-api.md) is decided: the contract's component list gains `<Steps>`, `<Prerequisites>`, `<LinkCards>` and the `deprecated` admonition type, beside `ApiReference` and the others already used.
