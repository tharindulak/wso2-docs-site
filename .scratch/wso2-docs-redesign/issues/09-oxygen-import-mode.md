# How the site imports Oxygen UI

Parent: [map](../map.md)
Type: grilling
Status: open
Assignee:
Blocked by:

## Question

Does a build-time import of `@wso2/oxygen-ui` 0.16.0 (pinned; tokens generated from its theme into CSS variables, plain `@mui/material` islands at runtime, 0 KB per page) meet the requirement to import the real package, or must browser code import it (islands only, `WSO2Theme` under a plain `ThemeProvider`, about +422 KB gzip per page until wso2/oxygen-ui#578 is fixed)? Also: how the generated variables are kept in step with Oxygen releases, how the wrong generated channel values are handled, and what happens to React updates under the exact 19.2.3 peer pin. Facts: [Oxygen UI 0.16 in the docs site](01-oxygen-ui-016-in-docusaurus.md).
