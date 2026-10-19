# What the design file specifies

Parent: [map](../map.md)
Type: research
Status: closed
Assignee: tharinduj
Blocked by:

## Question

What does the design file (`~/Downloads/WSO2 Cloud Docs - Version 1 (2).html`, mockups 1 and 2 only) specify for the look, element by element? For the header, sidebar (groups, nesting, active state), breadcrumbs, page title and lead text, body type scale, lists, buttons, cards, admonitions, figures, table of contents, last updated and edit link, previous/next, and footer: sizes, spacing, widths, colours, fonts, radii, borders and states, read from the rendered page's computed styles. Mark each value as matching an Oxygen UI token or not, using the token list from [Oxygen UI 0.16 in the docs site](01-oxygen-ui-016-in-docusaurus.md) once it is in.

## Answer

Resolved 2026-10-19 (research subagent). Findings: `.scratch/wso2-docs-redesign/research/02-design-file-inventory.md` on branch `research/design-file-inventory` (b1fc8102), read from computed styles in headless Chrome.

- Layout (1440 px frame): header 65 px; sidebar 300 px (`#f9fafb`, active row blue tint); content column against the sidebar, max 840 (doc page) or 900 (landing); "On this page" 252 px; footer navy `#0A1F44`, four columns 2:1:1:1.
- Type: system font stack; h1 36 to 38 px and h2 24 to 26 px at weight 700; body 15 px / 1.7.
- Accents: `#2B8CF7`, `#0A75F4` (links), `#0860D4` (active), tip `#047857` on `#f0fdf4`; Tailwind greys.
- Against Oxygen UI 0.16.0: layout, sizes and radii mostly fit; colours (none of about 30 match), font (Inter Variable), heading weight (400), line heights, shadows (none in Oxygen) and the active sidebar style do not. Oxygen wins, so the result keeps the design's layout but looks Oxygen-orange with Inter type.
- The design is inconsistent with itself on admonitions (info: radius 12, padding 18/20; tip: radius 8, padding 16/18); the doc page prototype picks one.
- For the Oxygen ticket: 0.16.0 ships no `theme.css` despite listing it; the theme provider can load a theme from a URL and run it with `new Function` (needs `unsafe-eval`; pass theme objects only, security review if URLs are ever used).
