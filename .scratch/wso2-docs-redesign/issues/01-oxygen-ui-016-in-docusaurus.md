# Oxygen UI 0.16 in the docs site

Parent: [map](../map.md)
Type: research
Status: closed
Assignee: tharinduj
Blocked by:

## Question

Can `@wso2/oxygen-ui` 0.16.0 (latest, 2026-10-15) be imported in the Docusaurus 3.10.2 site, and at what cost? In a production SSR build of one product section, measure: JS and CSS added per page when importing a few components (tree-shaking actually working, or the ~621 KB per page measured on 0.15.0); flash of unstyled content (Emotion styles server-rendered or not); Oxygen and Docusaurus dark modes in sync; CSS clashes with Infima. Check whether `theme.css` works as a tokens source for Infima variables, which themes or colour schemes it ships (is there a blue one matching the design), the React 19.2.3 peer pin against the site's React, the `@wso2/oxygen-ui-icons-react` peer, its licence, and its dependency tree for supply-chain risk. Baseline: [How Oxygen UI themes the docs site](../../wso2-docs-site/issues/04-oxygen-ui-in-docusaurus.md).

## Answer

Resolved 2026-10-19 (research subagent, production SSR builds of the Oxygen spike from `prototype/oxygen-ui-theming` upgraded to 0.16.0). Findings: `.scratch/wso2-docs-redesign/research/01-oxygen-ui-016-in-docusaurus.md` on branch `research/oxygen-ui-016-in-docusaurus` (39545207).

- Still not tree-shakeable: importing anything, even only `WSO2Theme`, adds about 422 KB gzip of JS per page (644 KB vs 222 KB today); about 215 KB of it is seven embedded Inter fonts. Upstream wso2/oxygen-ui#578 (open). The `exports` map points at files the package lacks, so per-component imports fail.
- No flash of unstyled content; dark mode stays in sync (`data-color-scheme`); islands under a plain MUI `ThemeProvider` clash with nothing, but `OxygenUIThemeProvider` always adds a global CSS reset over Infima (and #629 reports a one-frame light flash).
- `theme.css` does not exist (listed in `sideEffects` since 0.15). Tokens can be generated at build time: `WSO2Theme.generateStyleSheets()` gives 455 `--oxygen-*` variables for light and dark; some generated channel values are wrong (secondary). `WSO2Theme` radius is 20, not the 12 the site copied.
- Nine themes; none is a WSO2 blue. `WSO2Theme` primary #FF7300 fails AA as text (2.73:1; links use #B25000, 5.20:1). Closest to the design: `PaleIndigoTheme` #5567d5 (4.90:1).
- Peers: React 19.2.3 exact match (every site React update waits for Oxygen), `@mui/material` 7.3.4 matches; adds `@mui/utils` 9 beside 7.3.11; `@wso2/oxygen-ui-icons-react` required (lucide-react, ISC). Apache-2.0, 16 added packages MIT/ISC, about 105 MB node_modules, signed provenance, no install scripts.
- Recommendation: pin 0.16.0 and use it as a build-time tokens source (generate `--oxygen-*` variables, map Infima and the island theme onto them; 0 KB per page); keep plain `@mui/material` islands; do not import it in browser code until #578 is fixed. If shipped code must import it: islands only with `WSO2Theme`, never `OxygenUIThemeProvider`, +422 KB per page.
- Flags for human review: string (URL) themes are fetched and run with `new Function` (never pass them; would need CSP `unsafe-eval`); the package ships `.ai/` and `.claude/` agent instruction folders (untrusted for AI tools reading node_modules); `bin/cli.js` writes `AGENTS.md`, `CLAUDE.md` and `.claude/skills` where run (never run it in the repo).
