# How Oxygen UI themes the docs site

Parent: [map](../map.md)
Type: prototype
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

Should the docs site use Oxygen UI's MUI components directly inside Docusaurus, or extract Oxygen UI's colours, type and spacing into Docusaurus's own CSS variables (Infima) and use components only where needed? Build a throwaway spike to test: flash of unstyled content on load (Emotion styles not server-rendered), Oxygen UI and Docusaurus dark modes staying in sync, and CSS clashes. Oxygen UI is pre-1.0 (0.15.0) and releases weekly, so also decide how to pin it.

## Prototype findings (2026-10-06)

Prototype: `prototypes/oxygen-ui-theming/` (`npm run prototype`, then http://localhost:3001-3003/identity/). Docusaurus 3.10.2, Oxygen UI 0.15.0, React 19.2.3, production SSR builds.

| Variant | JS per page (gz) | MUI styles in SSR HTML | Global reset over Infima |
|---|---|---|---|
| A: OxygenUIThemeProvider wraps the site, MUI navbar | 621 KB | yes | yes (CssBaseline, not optional) |
| B: Oxygen values in Infima CSS variables, no MUI | 142 KB | n/a | no |
| C: B plus plain `@mui/material` islands with a theme rebuilt from Oxygen values | 193 KB | yes | no |

- No flash of unstyled content: Emotion inlines its styles into the server HTML with React 19, so the open Docusaurus issue #3236 did not bite.
- Any import from `@wso2/oxygen-ui` pulls its single bundle (all of MUI plus X DataGrid, DatePickers, TreeView): about 480 KB gz extra on every page.
- `OxygenUIThemeProvider` always renders `CssBaseline`; it cannot be scoped to part of a page.
- Oxygen UI's ESM bundle imports `prismjs/components/*` without extensions; webpack needs `fullySpecified: false` for it, and plain Node cannot import it.
- No tokens package: colour values were extracted at build time by script; they would drift unless pinned and re-extracted per Oxygen release.
- Oxygen's primary `#FF7300` on white is about 2.9:1 contrast, below WCAG AA 4.5:1 for body text; light mode links use `primary.dark` (#B25000) instead.
- Dark mode: Docusaurus uses `html[data-theme]`, MUI `html[data-color-scheme]`; a pre-paint inline script mirrors one to the other, and a hook keeps MUI's mode in step.

## Answer

Decided with the user, 2026-10-06: variant C now, real package later (the user accepted the recommendation; revisit if WSO2 requires the `@wso2/oxygen-ui` package itself, in which case use it only in islands and accept ~621 KB per page).

- The docs site takes Oxygen UI's look (colours, Inter, radius) through Infima CSS variables, with light-mode links on #B25000 for contrast.
- Interactive widgets (product switcher, deployment-option block, later others) are plain `@mui/material` islands under a theme rebuilt from Oxygen values, without CssBaseline; dark mode mirrored from `data-theme` to `data-color-scheme` before paint.
- Do not import `@wso2/oxygen-ui` in the site until it is tree-shakeable or ships a tokens package; then swap the hand-copied values and island theme for the package.
- Follow-up for the Oxygen UI team (hand-off item, not blocking): tree-shakeable build or tokens/CSS package, and fully specified ESM imports (`prismjs/components/*.js`).
- Prototype captured on branch `prototype/oxygen-ui-theming` (`prototypes/oxygen-ui-theming/`).
