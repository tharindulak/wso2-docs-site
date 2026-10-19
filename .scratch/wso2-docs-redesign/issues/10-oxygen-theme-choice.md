# Which Oxygen theme styles the docs site

Parent: [map](../map.md)
Type: grilling
Status: closed
Assignee: tharinduj
Blocked by:

## Question

Which Oxygen UI theme styles the site: `WSO2Theme` (orange #FF7300, text links #B25000 because the primary fails AA contrast, radius 20) or `PaleIndigoTheme` (#5567d5, closest to the design's blue, 4.90:1)? And which radius for cards and boxes (theme 20, or 12 as the site and design use)? Oxygen wins over the design (map Notes), so this picks the colour the whole site takes. Facts: [Oxygen UI 0.16 in the docs site](01-oxygen-ui-016-in-docusaurus.md), [What the design file specifies](02-design-file-inventory.md).

## Answer

Decided with the user, 2026-10-19:

- `WSO2Theme` (orange #FF7300). Link text uses the darker #B25000, since #FF7300 fails AA contrast as text.
- Corner radii follow the mockups, not the theme's 20: per element as measured in [What the design file specifies](02-design-file-inventory.md) (cards and boxes 8 to 12, search box 8, pill buttons). The design's two admonition radii (8 and 12) are reconciled in the doc page prototype.
