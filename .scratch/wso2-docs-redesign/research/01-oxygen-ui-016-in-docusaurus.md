# 01 Oxygen UI 0.16 in the docs site (researched 2026-10-19)

Answers [issue 01](../issues/01-oxygen-ui-016-in-docusaurus.md). Baseline: [How Oxygen UI themes the docs site](../../wso2-docs-site/issues/04-oxygen-ui-in-docusaurus.md) (0.15.0 spike, 2026-10-06).

Sources: the published npm tarballs of `@wso2/oxygen-ui` 0.16.0 and 0.15.0 and `@wso2/oxygen-ui-icons-react` 0.16.0 (read file by file before running anything), npm registry metadata, the wso2/oxygen-ui GitHub repo and issues (via `gh`), the docs site's `package.json` and `node_modules` in the docs-forks-preview worktree, and a throwaway spike: the 0.15 prototype source (branch `prototype/oxygen-ui-theming`) upgraded to 0.16.0 and built as five production SSR variants, measured from the build output and in headless Chrome. **[inference]** marks my reasoning; **[unverified]** marks claims not confirmed in a primary source.

Scope note (user, 2026-10-19): one docs site with merged cloud and self-hosted pages, no Cloud/Releases switch. Nothing here assumes a switch component.

## TL;DR

- **0.16.0 is not tree-shakeable; nothing changed from 0.15.0 in build shape.** Importing anything from the package, even only the `WSO2Theme` object, costs **+422 KB gz of JS on every page** (644 KB vs 222 KB loaded in Chrome). Same as 0.15.0.
- About **215 KB gz of that is seven Inter font files inlined as base64** and injected client-side, duplicating the `@fontsource-variable/inter` the site already loads. The rest is Oxygen's code, MUI X DataGrid and Prism with eight languages. Date pickers and tree view are dropped.
- **`theme.css` does not exist.** It is in `sideEffects` (since 0.15 at least) but not in the tarball or in the repo source. The usable tokens source is the JS theme object, read **at build time**: `WSO2Theme.generateStyleSheets()` emits 455 `--oxygen-*` custom properties for light and dark that Infima variables can point at.
- **SSR, dark mode and CSS clashes are fine for islands** under a plain MUI `ThemeProvider`: Emotion styles are in the server HTML, dark mode stays in sync through the existing mirror script, and the only global CSS is custom properties. `OxygenUIThemeProvider` still forces `CssBaseline` (global reset over Infima) and has an open dark-mode flash bug (#629).
- **No WSO2-branded blue scheme.** Nine themes ship; the closest to the design's blue is `PaleIndigoTheme` (#5567d5). `WSO2Theme` is orange #FF7300.
- **React:** the site is on 19.2.3, exactly the peer pin. `@mui/material` 7.3.4 matches too. The package drags in a second `@mui/utils` (9.0.0 next to 7.3.11).
- **Licence** Apache-2.0; all added dependencies MIT or ISC. **Supply chain** is good on provenance (GitHub Actions trusted publishing, SLSA attestation, no install scripts), with code-level flags listed in §8.
- **Recommendation:** import the package as a **build-time tokens source** (generated CSS variables for Infima and the island theme), keep plain `@mui/material` islands at runtime, and do not import it in browser code until upstream issue #578 is fixed.

## 1. What 0.16.0 is (package facts)

From the tarball and `npm view @wso2/oxygen-ui@0.16.0`:

- Published 2026-10-15T02:10Z by "GitHub Actions" via npm trusted publishing (OIDC), with an SLSA provenance attestation and registry signatures. Maintainer: `wso2-org <techops@wso2.com>`. Repo: github.com/wso2/oxygen-ui (Apache-2.0, not archived).
- Release cadence: 0.13.0 (07-15), 0.13.1 (08-06), 0.14.0 (09-23), 0.15.0 (10-01), 0.16.0 (10-15).
- Changes since 0.15.0 (CHANGELOG): a `RelativeTime` component, a `ListingTable` "no results" state, a hamburger icon for `HeaderToggle`. In the bundle diff: those plus `MuiBreadcrumbs` overrides. **`package.json` (dependencies, peers, `sideEffects`, `exports`) is identical to 0.15.0**, and `WSO2Theme` is byte-for-byte unchanged.
- Files: one JS bundle, `dist/index.js` (578 KB, ESM, unminified, built by esbuild with `bundle: true, splitting: false` and all dependencies external), plus `.d.ts` files, `bin/cli.js`, and `.ai/` and `.claude/` folders of AI-agent instructions and skills.
- The `exports` map advertises `require: ./dist/index.cjs` and `./*` subpaths (`./dist/*.js`). **Neither exists** (only `.d.ts` files are emitted per path). Checked in Node: subpath import fails with `ERR_MODULE_NOT_FOUND`, `require()` fails with `MODULE_NOT_FOUND`. Per-component imports are therefore impossible.
- Plain Node still cannot import the root entry: the bundle imports `prismjs/components/prism-*` without extensions. Webpack needs `resolve.fullySpecified: false` for the package, as on 0.15.
- Dependencies (exact pins except prismjs): `@mui/material` 7.3.4, `@mui/utils` 9.0.0, `@mui/x-data-grid` 8.16.0, `@mui/x-date-pickers` 8.16.0, `@mui/x-tree-view` 8.14.0, `@emotion/react` 11.14.0, `@emotion/styled` 11.14.1, `@emotion/cache` 11.14.0, `@fontsource-variable/inter` 5.2.8, `date-fns` 4.1.0, `prismjs` ^1.30.0.
- Peers: `react` 19.2.3, `react-dom` 19.2.3 (exact), `@wso2/oxygen-ui-icons-react` >=0.1.0.

## 2. Per-page cost (tree-shaking)

Spike: the 0.15 prototype upgraded to 0.16.0, Docusaurus 3.10.2, React 19.2.3, production SSR builds, page `/identity/` (one doc page with a "Deployment options" block and an MUI product switcher in the navbar). "Loaded" is every same-origin JS file Chrome requested (net log), gzip -9 sizes from disk.

| Variant | What imports what | JS loaded (gz) | JS raw | CSS (gz) |
|---|---|---|---|---|
| A | `OxygenUIThemeProvider` wraps the site, MUI navbar from `@wso2/oxygen-ui` | 644.2 KB | 1,721 KB | 15.0 KB |
| C | islands, components from `@mui/material/*`, theme hand-built from Oxygen values (the site today) | 221.8 KB | 688 KB | 16.0 KB |
| D | islands, the same 8 components (Button, Menu, MenuItem, ListItemText, Paper, Stack, Chip, Typography) **and** the theme from `@wso2/oxygen-ui` | 644.2 KB | 1,719 KB | 16.0 KB |
| E | as C, but **only** `WSO2Theme` imported from `@wso2/oxygen-ui` | 644.2 KB | 1,719 KB | 16.0 KB |

- **Any import costs +422.4 KB gz per page** (D or E against C). Importing eight components or only the theme makes no difference: the cost is the module, not what you use from it.
- For comparison with the baseline's method (scripts referenced in the HTML only): A is 622.2 KB on 0.16.0 and 623.8 KB on 0.15.0, so the baseline's "~621 KB" still holds.
- In this spike, B (no MUI at runtime) measured the same as C because its deployment block still imports MUI statically. The baseline's 142 KB for B came from a different setup and was not re-measured.

What the extra 427 KB gz in `main.js` is (E against C, `main.js` only, 620.2 vs 193.4 KB gz):

- **215.4 KB gz: seven Inter woff2 fonts inlined as base64** (285 KB raw). An esbuild plugin (`@wso2/esbuild-plugin-inline-css-fonts`) turns `src/fonts.css` into a top-level function that runs on import and appends a `<style data-oxygen-fonts>` with `@font-face` data URIs. This is a module side effect even though `sideEffects` does not declare it. In the hydrated DOM it is a 287 KB style element. The site already serves Inter through `@fontsource-variable/inter` CSS.
- **About 209 KB gz of code:** Oxygen's components and themes, MUI X DataGrid (85 `MuiDataGrid` references in the output), Prism with eight languages registered by side-effect imports, and a second copy of `@mui/utils` (9.0.0). `@mui/x-date-pickers` and `@mui/x-tree-view` were tree-shaken away.
- Why webpack cannot drop more (upstream issue [#578](https://github.com/wso2/oxygen-ui/issues/578), open since 2026-09-09, no replies): one bundled file, `export * as DataGrid/DatePickers/TreeView`, `CodeBlock` imports Prism at top level, `ListingTable` does `styled(DataGrid)` at top level, and `tsc` emits declarations only, so `exports["./*"]` cannot work. The `sideEffects` list (theme CSS only) cannot remove statements that share a file with `Button`. **[inference]** Consumer-side aliases that stub `@mui/x-data-grid` and `prismjs` would cut part of the code but not the inline fonts, and break if a page later uses `ListingTable` or `CodeBlock`.

## 3. Flash of unstyled content (Emotion SSR)

- **No FOUC for islands (D, E) or for A.** The server HTML carries the Emotion styles: on `/identity/`, D has nine `<style data-emotion>` tags, with component styles (`css …`) and one `css-global` block of custom properties. Same pattern as on 0.15.0.
- The inline-font style is **not** server-rendered; it is added on the client after the bundle runs. **[inference]** Because the site already declares the same family through fontsource, this costs bytes and a second set of `@font-face` rules rather than a visible flash, but it can trigger a font re-match after hydration. Not measured with a screencast.
- Each island repeats the theme's `css-global` variables block (20.9 KB raw per island in D; 22.2 KB in C), so a page with two islands carries it twice in its HTML (D: 66.5 KB HTML vs 14.6 KB with no islands). This is a property of the island pattern, not of 0.16. **[inference]** One theme provider without `CssBaseline` at Root would emit it once.
- Upstream [#629](https://github.com/wso2/oxygen-ui/issues/629) (open, 2026-10-02): `OxygenUIThemeProvider` paints the light palette for one frame on load in dark mode, because it forwards neither `noSsr` nor supports `InitColorSchemeScript`. Another reason not to use it in the docs site.

## 4. Dark mode sync with Docusaurus

- `WSO2Theme` (and every shipped theme) uses `colorSchemeSelector: "data-color-scheme"` and `cssVarPrefix: "oxygen"`: the same as the site's hand-built island theme, so it is a drop-in swap.
- With the existing pre-paint mirror script (`data-theme` to `data-color-scheme`) and the `useColorScheme` hook, the hydrated `<html>` in headless Chrome showed `data-theme="dark" data-color-scheme="dark"` with a dark system preference and `light/light` with a light one, for both D and A.
- Nothing in 0.16 changes this mechanism; no Oxygen API helps either (no Docusaurus integration; feature request [#500](https://github.com/wso2/oxygen-ui/issues/500) open since 2026-02-23).

## 5. CSS clashes with Infima

- **Islands under plain `ThemeProvider` (C, D, E): no clash.** The only global selectors in their styles are `:root`, `:root,[data-color-scheme="light"]` and `[data-color-scheme="dark"]`, all custom properties.
- **`OxygenUIThemeProvider` (A): clash.** It always renders `<CssBaseline enableColorScheme />` (bundle line 2142); the SSR HTML has globals on `*,*::before,*::after`, `html`, `body` and `body::backdrop`, overriding Infima. Unchanged from 0.15.
- **[inference]** Oxygen's component overrides (button radius 20, Acrylic gradients) only apply inside islands, so Infima-styled content outside them will not match unless Infima variables take the same values (see §6).

## 6. `theme.css` and tokens for Infima

- **`theme.css` is not shipped.** `sideEffects` lists `src/styles/Themes/theme.css` and `dist/styles/Themes/theme.css`, but neither is in the 0.15.0 or 0.16.0 tarball, and `packages/oxygen-ui/src/styles/` on `main` has only `.ts` files. The entry is stale. There is no tokens or CSS package in the repo either.
- **What works: build-time extraction from the JS theme.** A Node script (with a loader hook for the extensionless Prism imports and a CSS stub, as in the baseline) imports `WSO2Theme` and calls MUI's `generateStyleSheets()`. Result: 455 `--oxygen-*` declarations in three blocks (`:root`, `:root,[data-color-scheme="light"]`, `[data-color-scheme="dark"]`), 23 KB. Example values: `--oxygen-palette-primary-main: #FF7300`, `--oxygen-palette-primary-dark: rgb(178, 80, 0)`, `--oxygen-palette-background-default: #ffffff` (dark `#0f172a`), `--oxygen-shape-borderRadius: 20px`.
- Infima can then point at them, for example `--ifm-color-primary: var(--oxygen-palette-primary-dark)` in light mode. Infima's dark selector is `[data-theme='dark']`; the mirror script keeps `data-color-scheme` in step, so both sets switch together. **[inference]** The `--ifm-color-primary-dark/-darker/…` shades Infima expects are not in Oxygen's output and still need computing (as the Docusaurus colour generator does).
- Running the script at build time puts the package in the build, not in the browser bundle, and re-extraction per Oxygen release replaces hand-copying.
- **Quality caveats in the generated variables:**
  - Some `…Channel` values do not match their colours: `secondary-mainChannel: 117 117 117` for `#5CD1FF`, `background-defaultChannel: 250 250 250` for `#ffffff`, `text-primaryChannel: 0 0 0` for `#181818`. MUI uses channels for translucent colours (`rgba(var(--…Channel) / a)`), so hover and overlay tints would come out grey or black. **[inference]** The cause looks like `createOxygenTheme` deep-merging over an already-extended base theme. Not reported upstream.
  - `--oxygen-palette-Skeleton-bg` contains the fallback `undefined`.
  - `WSO2Theme.shape.borderRadius` is **20** in both 0.15.0 and 0.16.0; the site uses 12 (Infima) and 10 (island). **[unverified]** where the baseline's 12 came from.

## 7. Themes and colour schemes (is there a blue one?)

Nine themes are exported; each has light and dark schemes. Primary `main` per scheme, from the built theme objects:

| Export | Light primary | Dark primary | Light bg | Radius | Note |
|---|---|---|---|---|---|
| `WSO2Theme` | #FF7300 | #FF7300 | #ffffff | 20 | the WSO2 brand theme; `primary.dark` #B25000 |
| `OxygenTheme` (Acrylic base) | #fa7b3f | #F87643 | #f5f5f5 | 12 | translucent "acrylic" surfaces |
| `AcrylicOrangeTheme` | #fa7b3f | #F87643 | #f5f5f5 | 12 | |
| `AcrylicPurpleTheme` | #646cff | #646cff | #f5f5f5 | 12 | violet-blue |
| `ClassicTheme` | #ff7300 | #ff7300 | #fafafa | 4 | |
| `PaleBaseTheme` | #ff7300 | #ff7300 | #fafafa | 8 | |
| `PaleGrayTheme` | #212121 | #E0E0E0 | #F5F5F5 | 8 | monochrome |
| `PaleIndigoTheme` | #5567d5 | #7785dd | #F5F5F5 | 8 | indigo-blue; `primary.dark` #3f4db5 |
| `HighContrastTheme` | #0000FF | #00FFFF | #FFFFFF | 4 | accessibility theme |

- **No theme named or branded as a WSO2 blue.** The nearest to the design is **`PaleIndigoTheme`**. The most frequent hex in the design file's readable text is `#5568c4` (11 times), with lighter shades `#6c7fd8`, `#8fa0ea`, `#a8b5ff`. **[unverified]** The design page is a bundle with packed resources, so this count may miss colours.
- WCAG contrast on white (body text needs 4.5:1): #FF7300 2.73:1 (fails), #B25000 5.20:1, design #5568c4 5.04:1, PaleIndigo #5567d5 4.90:1, #3f4db5 7.14:1, AcrylicPurple #646cff 4.09:1 (fails). PaleIndigo dark #7785dd on #0f172a: 5.26:1.
- **Decision for the user:** the map says Oxygen wins on colour. Either keep `WSO2Theme` orange (links on #B25000) or adopt `PaleIndigoTheme`, the shipped theme closest to the design's blue. Taking PaleIndigo also brings its 8 px radius and grey #F5F5F5 page background.

## 8. React peer, icons peer, licence, dependency tree, supply chain

**React.** The docs site pins `react` and `react-dom` 19.2.3 (`package.json`, and 19.2.3 in `node_modules`): an exact match for Oxygen's exact peer pin. `@mui/material` 7.3.4 and `@emotion/*` versions also match. **[inference]** Because the peer pin is exact, every React patch on the site waits for an Oxygen release with the same pin, or npm refuses to install (ERESOLVE) without `--legacy-peer-deps`. `@mui/utils` 9.0.0 (a major ahead of the 7.3.11 that `@mui/material` 7 uses) installs as a nested second copy under `@wso2/oxygen-ui`.

**`@wso2/oxygen-ui-icons-react` 0.16.0.** Apache-2.0; dependency `lucide-react` 1.16.0 (ISC); peer react 19.2.3; `sideEffects` covers its CSS. Its entry re-exports all of `lucide-react` plus 8 brand icons (WSO2, GitHub, GitLab, Bitbucket, Google, Facebook, Lambda, MCP) and imports a 780-byte `icons.css`. Oxygen's bundle imports it in 19 places, so it must be installed even if unused. Ships CJS and per-icon files, so it is tree-shakeable itself. The peer range `>=0.1.0` is open-ended.

**Licence.** `@wso2/oxygen-ui` and the icons package: Apache-2.0. Added dependencies: MIT (MUI X community packages data-grid, date-pickers, tree-view, x-internals, x-virtualizer, `@base-ui-components/utils`, `@floating-ui/utils`, date-fns, reselect, use-sync-external-store, prismjs) and ISC (lucide-react). No Pro or Premium MUI X packages. No conflicts with Apache-2.0 found. Recommend the usual legal check before release.

**Dependency tree.** On top of what the site already has (Docusaurus, MUI 7.3.4, Emotion, fontsource, prismjs), the package adds **16 installed packages**: `@wso2/oxygen-ui`, `@wso2/oxygen-ui-icons-react`, `@mui/utils@9.0.0`, `@mui/types@9.5.0`, `@mui/x-data-grid`, `@mui/x-date-pickers`, `@mui/x-tree-view`, `@mui/x-internals` (8.14.0 and 8.16.0), `@mui/x-virtualizer`, `@base-ui-components/utils` (deprecated: "renamed to @base-ui/utils"), `@floating-ui/utils`, `date-fns`, `lucide-react`, `reselect`, `use-sync-external-store`, `@types/prop-types`. About 105 MB in `node_modules` (lucide-react 39 MB, date-fns 38 MB, MUI X 25 MB). Optional date-library peers of the date pickers (moment, luxon, dayjs, …) are not installed. `npm install --ignore-scripts` in the spike: the only package in the tree with an install script was `core-js` (a Docusaurus dependency).

**Supply-chain and code flags (for human review):**

1. **Remote theme loader that runs code.** `OxygenUIThemeProvider` accepts `themes` entries whose `theme` is a URL string; `loadThemeFile` fetches it (same origin only, JS content type, under 500 KB, rejects text containing `eval(`/`Function(`) and executes it with `new Function`. Only reached if a caller passes string themes; the docs site must not. It would also need CSP `unsafe-eval`. Present in 0.15 too.
2. **Agent instruction files in the package.** `.ai/` and `.claude/` (including skills `oxygen-migrate`, `oxygen-sync` and others) ship in the tarball. AI tools that read `node_modules` could treat them as instructions. Treat as untrusted content.
3. **`bin/cli.js` (`oxygen-ui` command)** copies those files into the current directory and edits `AGENTS.md`, `CLAUDE.md` and `.claude/skills`. It runs only when invoked, not on install. Do not run it in this repo without review.
4. **Undeclared side effect:** the inline-font injector runs on import (adds a `<style>` and reads `__webpack_nonce__` or CSP meta tags), contrary to the `sideEffects` declaration.
5. **Broken `exports` map** (`index.cjs`, `./*` JS missing) and stale `sideEffects` entry: release hygiene, not a security issue.
6. **Positive:** trusted publishing with provenance, exact dependency pins (except `prismjs ^1.30.0`), no install scripts, WSO2-owned maintainer account.

## 9. Recommendation

**[inference]** This is a recommendation for the user's decision, not a decision.

1. **Use `@wso2/oxygen-ui` 0.16.0 as a build-time tokens source; do not import it in browser code yet.** Pin it exactly. A build step runs `WSO2Theme.generateStyleSheets()` (or the chosen theme's), writes a CSS file of `--oxygen-*` variables, and maps the `--ifm-*` variables onto them. Islands keep plain `@mui/material` components under a `ThemeProvider` whose palette is generated from the same extraction. This replaces the hand-copied values in `site/src/css/oxygen.css` and `MuiIsland.js`, adds 0 KB per page, and makes the package the real source of the look.
2. **Runtime import only if WSO2 requires it in shipped code:** islands under a plain `ThemeProvider` with `WSO2Theme`, never `OxygenUIThemeProvider` (forced `CssBaseline` and #629). Accept +422 KB gz per page, of which 215 KB is duplicated fonts.
3. **Revisit when** upstream ships per-component ESM (fixes #578), drops or separates the inline fonts, or ships the advertised `theme.css`. Re-measure with this spike then.
4. **Correct the variables Oxygen generates** before relying on translucent tints (§6 channel mismatch), and decide the radius (Oxygen 20 vs the site's 12).
5. **Colour decision needed:** `WSO2Theme` orange vs `PaleIndigoTheme` (closest to the design's blue). Launch-critical, because it changes every page.
6. **Hand-off items for the Oxygen UI team:** #578 (tree-shaking); inline fonts as an opt-in or a separate CSS entry; a tokens or CSS package or the real `theme.css`; fixing the `exports` map; fixing the `…Channel` values; fully specified Prism imports; a less exact React peer range.

## Spike reproduction

Throwaway, not committed. Source: `git archive 02ba5f7 prototypes/oxygen-ui-theming`, upgraded in a scratch directory to `@wso2/oxygen-ui` and icons 0.16.0, with `@mui/material` 7.3.4 and Emotion declared directly. Two webpack aliases pick the source per variant: `proto-ui` (components from `@mui/material/*` or from `@wso2/oxygen-ui`) and `proto-theme` (hand-built theme or `WSO2Theme`). Build with `BUILD_ONLY=1 node scripts/run-variants.mjs A,B,C,D,E`, serve on ports 3101-3105, measure with Chrome `--log-net-log`. The docs site and its full build were not touched.
