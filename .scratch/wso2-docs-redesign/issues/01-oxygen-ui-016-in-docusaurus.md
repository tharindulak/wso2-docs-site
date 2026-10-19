# Oxygen UI 0.16 in the docs site

Parent: [map](../map.md)
Type: research
Status: open
Assignee:
Blocked by:

## Question

Can `@wso2/oxygen-ui` 0.16.0 (latest, 2026-10-15) be imported in the Docusaurus 3.10.2 site, and at what cost? In a production SSR build of one product section, measure: JS and CSS added per page when importing a few components (tree-shaking actually working, or the ~621 KB per page measured on 0.15.0); flash of unstyled content (Emotion styles server-rendered or not); Oxygen and Docusaurus dark modes in sync; CSS clashes with Infima. Check whether `theme.css` works as a tokens source for Infima variables, which themes or colour schemes it ships (is there a blue one matching the design), the React 19.2.3 peer pin against the site's React, the `@wso2/oxygen-ui-icons-react` peer, its licence, and its dependency tree for supply-chain risk. Baseline: [How Oxygen UI themes the docs site](../../wso2-docs-site/issues/04-oxygen-ui-in-docusaurus.md).
