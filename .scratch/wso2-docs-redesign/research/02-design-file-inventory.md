# What the design file specifies for mockups 1 and 2 (2026-10-19)

Ticket: [02](../issues/02-design-file-inventory.md). Map: [docs site redesign](../map.md).

## Sources and method

- **Design file**: `~/Downloads/WSO2 Cloud Docs - Version 1 (2).html` (1,799,797 bytes, dated 19 Oct 11:08). A bundled page that unpacks itself with JavaScript into `#dc-root`. Opened only in headless Chrome 155 (`--headless=new`, throwaway `--user-data-dir` in the session scratch directory, viewport 1440 x 900, device scale 1), driven over the DevTools protocol from a Node 22 script kept outside the repository. Nothing was copied into the repository.
- **What was read**: every element inside frame `#1a` (Mockup 1, "Documentation landing page") and frame `#1b` (Mockup 2, "Platform documentation page (API Platform)"): `getComputedStyle` for font, colour, border, radius, shadow, padding, margin, gap, display, grid columns, max width, position; `getBoundingClientRect` for sizes; and each element's inline `style` attribute, which names the design tokens (CSS custom properties) the author used. Custom property values were read as computed on `#1b`, so they are the light-mode values in force. Mockups 3 and 2A to 2C were not read (out of scope).
- **States**: the mockups are static. All 1A/1B styles are inline `style` attributes (no class-based rules apply to them, so no `:hover` CSS reaches them). Dispatching `mouseover`/`mouseenter`/`pointerover` on every element in both frames changed no colour, background, border, shadow or decoration. The only states the design shows are **current/active** (sidebar, ToC) and **expanded/collapsed** (sidebar chevrons). Hover, focus and pressed states are **not specified**. One unused token hints at intent: `--w-shadow-hover: 0 6px 18px rgba(43,140,247,.18), 0 2px 6px rgba(0,0,0,.05)` is defined on `:root` but no 1A/1B element uses it.
- **Oxygen UI**: `@wso2/oxygen-ui@0.16.0` fetched with `npm pack` into scratch and read only (not executed). The package ships **no CSS file**: `find package -name "*.css"` returns nothing, although `package.json` `sideEffects` lists `dist/styles/Themes/theme.css`. Theme values were read from the TypeScript sources embedded in `dist/index.js.map` (`src/styles/OxygenThemeBase.ts`, `src/styles/Themes/AcrylicBaseTheme.ts`, `src/styles/Themes/WSO2Theme.ts`, `src/contexts/OxygenUIThemeProvider/OxygenUIThemeProvider.tsx`). Values Oxygen does not override fall back to MUI defaults; those are marked **MUI** and come from MUI's documented defaults, not from this package (lower confidence; confirm against the parallel ticket 01 once it lands).

Units: px at 1440 px frame width. Colours given as hex, with the design token the inline style used in `code`. "normal" line height means the design set none (the system font's default, about 1.2).

## Oxygen 0.16.0 reference values used for matching

Two themes matter. `OxygenUIThemeProvider` defaults to `OxygenTheme`, which is **AcrylicBaseTheme**; **WSO2Theme** is the WSO2-branded one (and the colour the site uses today, `#FF7300`).

| Token | OxygenThemeBase | AcrylicBaseTheme (default) | WSO2Theme |
|---|---|---|---|
| Font family | `'Inter Variable', sans-serif` | inherits | inherits |
| Base font size | 14px | inherits | inherits |
| h1 / h2 / h3 / h4 / h5 / h6 | 28 / 24 / 22 / 20 / 16 / 14px; weight 400 (h6 500) | inherits | inherits |
| subtitle1 / subtitle2 | 18px / 14px 400 | inherits | inherits |
| body1 / body2 / caption | 14px / 13px 400 / 11px 400 | inherits | inherits |
| button | 14px 500 | Button weight 400, `textTransform: none`, radius 20 | radius from shape (20) |
| Line heights, letter spacing | MUI defaults (body1 1.5, body2 1.43, h1 1.167, h2 1.2, caption 1.66, button 1.75) | inherits | inherits |
| shape.borderRadius | MUI default 4 | **12** | **20** |
| Other radii | | ListItemButton 8, OutlinedInput 8 | |
| Shadows | **all `none`** | inherits (Paper uses `shadows[1]` = none) | inherits |
| primary.main | `#ff7300` | `#fa7b3f` (contained primary button uses gradient `#F47B20 -> #EF4223`) | `#FF7300` |
| secondary.main | `#757575` | `#e8e8e8` | `#5CD1FF` |
| text.primary / secondary | MUI default | `#40404B` / `#40404B` | `#181818` / `#181818` |
| background.default / paper | `#fafafa` / `#ffffff` | `#f5f5f5` / `#ffffffc5` (acrylic `#ffffff40`) | `#ffffff` / `#ffffffc5` |
| divider | MUI default `rgba(0,0,0,0.12)` | `#00000012` | inherits base |
| success / info main | MUI default (`#2e7d32` / `#0288d1`) | not overridden | `#2e7d32` / `#0277bd` |
| Blur | light 3px, medium 10px, heavy 20px | inherits | light 10px, medium 16px, heavy 24px |
| Spacing unit | MUI default 8px (`theme.spacing(n)`) | inherits | inherits |
| Breadcrumbs | parents `text.secondary`; last item `text.primary`, weight **700**; separator `text.disabled` | inherits | inherits |
| Link | | `primary.main`, no underline; hover `primary.dark` + underline | `primary.main` |

Matching rule for each value below:

- **Yes**: equals an Oxygen token in AcrylicBaseTheme or WSO2Theme (named).
- **MUI**: equals an MUI default that Oxygen inherits without override.
- **Grid**: a spacing value that is a multiple of 8 (`theme.spacing(n)`); **Half**: a multiple of 4 (`theme.spacing(n.5)`).
- **No**: no token holds this value; nearest token given where useful.

## The design's own tokens (as authored)

The inline styles reference a token set on `:root`, light values computed on the frame:

| Group | Values |
|---|---|
| Blue scale `--w-primary*` / `--web-primary*` | lightest `#75B6FA`, lighter `#50A1F9`, light `#4499F8`, **primary `#2B8CF7`**, dark `#157EF5`, **darker `#0A75F4`**, **darkest `#0860D4`** |
| Navy `--w-navy` / `--web-navy` | `#0A1F44` |
| Neutrals `--grey-*` (Tailwind gray) | 50 `#f9fafb`, 100 `#f3f4f6`, 200 `#e5e7eb`, 300 `#d1d5db`, 400 `#9ca3af`, 500 `#6b7280`, 600 `#4b5563`, 700 `#374151`, 900 `#111827` |
| Foreground | `--fg-primary` `#111827`, `--w-fg` `#0f1117` (inherited body colour), `--w-fg-muted` `#4b5563`, `--w-fg-subtle` `#6b7280` |
| Borders | `--border-default` / `--w-border` `#e5e7eb`, `--border-subtle` `#f3f4f6`, `--border-strong` `#d1d5db` |
| Backgrounds | `--w-bg` `#ffffff`, `--w-bg-alt` `#f6f8fb`, sidebar `--grey-50` `#f9fafb` |
| Status | `--status-ok` `#047857`, `--status-bg-success` `#f0fdf4`, `--status-bg-info` `#eef2ff` (unused in 1A/1B) |
| Radii | `--radius-xs` 4, `--radius-sm` 8, `--radius-md` 12, `--radius-lg` 16, `--radius-pill` 999 |
| Shadows | `--shadow-card` `0 1px 3px 0 rgba(0,0,0,.05), 0 1px 2px 0 rgba(0,0,0,.03)`; `--shadow-lg` (frame only) |
| Spacing `--space-1..8` | 8 to 64 in steps of 8 (defined; the inline styles mostly use literal px instead) |
| Type tokens `--type-*` | h1 38/700, h2 28/700, h3 20/600, body1 14/1.6, body2 13/1.5, button weight 500. **Defined but not used by 1A/1B**, whose inline sizes differ (h2 is 26 and 24, not 28). |
| Fonts | `--font-system` (system stack), `--font-display` `"Ubuntu Sans", system stack` (Ubuntu Sans is embedded as a variable font), `--font-mono` |

**Font actually rendered in 1A and 1B**: every element computes to `-apple-system, "system-ui", "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif` (inherited from the page's `html, body` rule). No element in 1A or 1B uses Ubuntu Sans or a monospace font. The Ubuntu Sans face reports status `unloaded`, which means nothing on these frames requested it.

## Page layout

| Property | Mockup 1 (landing) | Mockup 2 (platform doc) | Oxygen |
|---|---|---|---|
| Frame width | 1440 | 1440 | n/a (mockup canvas) |
| Page background | `#ffffff` | `#ffffff` | Yes: WSO2Theme `background.default`. No for Acrylic (`#f5f5f5`) |
| Default text colour | `#0f1117` `--w-fg` | same | No (text.primary `#40404B` / `#181818`) |
| Font family | system stack | system stack | No (Inter Variable) |
| Header height | 65 (64 + 1px bottom border) | 65 | MUI: desktop Toolbar min height 64 |
| Body grid | `300px 1fr` (300 + 1138) | `300px minmax(0,1fr) 252px` (300 + 886 + 252) | n/a |
| Sidebar width | 300 | 300 | No (Oxygen Sidebar width not checked; record raw) |
| Main column | max-width 900, padding 32 56 64, so text width **788**; not centred, sits against the sidebar | max-width 840, padding 32 56 56, so text width **728**; 46px spare to the right of the column at 1440 | Padding 32 Grid, 56 Grid, 64 Grid |
| Paragraph measure | max-width 720 (lead, body); list max-width 760 | full 728 | n/a |
| ToC column | none | 252 | n/a |
| Body min height | 1000 | 1080 | n/a |
| Footer height | 335 | 335 | n/a |
| Sticky parts | none: every element computes `position: static` (header, sidebar and ToC stickiness are not specified) | same | n/a |

## Header (both mockups identical)

| Part | Values | Oxygen |
|---|---|---|
| Bar | flex, align centre, gap **22**, padding **14 28**, background `rgba(255,255,255,0.92)` with `backdrop-filter: blur(8px)`, bottom border 1px `#e5e7eb` `--w-border` | Gap No; padding No (14, 28 off grid); background No (Acrylic AppBar uses `background.acrylic` `#ffffff40` + blur 10px); blur No (3/10/16 only); border colour No (divider `#00000012`) |
| Logo mark | 28 x 28, radius **6**, background `#0A1F44` `--w-navy`, letter "W" 15px / 700 / letter-spacing -0.02em (-0.3px) white, centred | Radius No; navy No |
| Brand text | "WSO2 Cloud" 18px / 700 / -0.01em (-0.18px) `#0A1F44`; "Documentation" 18px / 400 `#4b5563` `--w-fg-muted`; gap 10 between mark and text | 18px Yes (subtitle1 size; weight differs); 700 MUI (`fontWeightBold`); colours No; gap No |
| Search box | centred in a flex: 1 area; **460 x 36**, padding 0 12, gap 10, border 1px `#e5e7eb`, radius **8**, background `#f6f8fb` `--w-bg-alt` | Radius Yes (Acrylic OutlinedInput 8); 36 height No (small input is about 40); colours No |
| Search icon | lucide `search` 16px `#6b7280` | colour No |
| Placeholder | "Search all documentation" 13.5px / 400 `#6b7280` | No (body2 13) |
| Shortcut chip | "⌘K" 11px / 600 `#4b5563`, background white, border 1px `#e5e7eb`, radius 4, padding 2 6 | 11px Yes (caption size); radius MUI (4 is MUI default shape, overridden by both Oxygen themes) |
| Language picker | "English" 36 high, padding 0 10, radius 8, 14.5px / 500 `#4b5563`, globe 16 + chevron 15, gap 6 | **Out of scope** (map: no language picker) |
| Theme toggle | two 36 x 36 buttons, radius 8, icons 18 (lucide `sun`, `moon`), gap 10. Active (sun): background `rgba(43,140,247,0.08)`, icon `#0A75F4` `--w-primary-darker`. Inactive (moon): transparent, icon `#4b5563` | Radius Yes (8 as ListItemButton/OutlinedInput); colours No |

## Sidebar

Container: column 300 wide, background `#f9fafb` `--grey-50`, right border 1px `#e5e7eb`; inner list padding **24 16 40**, gap **2** between rows; flex column with `space-between` and an empty 28px footer slot.

| Row type | Font | Colour | Box | Oxygen |
|---|---|---|---|---|
| Level 1 leaf (e.g. "Security and Compliance", "Support", 2: "Overview") | 14px / 500 / normal | `#374151` `--grey-700` | padding 7 12 (31 high), radius 8 | 14 Yes (body1); 500 Yes (`fontWeightMedium`); colour No; radius Yes (ListItemButton 8); padding No |
| Level 1 category with children ("Get Started", "Organization", "Users and Access", "Billing and Pricing") | 14px / **600** | `#111827` `--grey-900` | padding 7 12, margin-top **8**, radius 8, chevron 16 at right `#9ca3af` (down when expanded, right when collapsed) | 600 No (MUI weights 300/400/500/700); colours No; margin 8 Grid |
| Level 1 under the "Platform" label (product rows) | 14px / 500 | `#374151` | padding 7 12, radius 8, chevron-right 16 `#9ca3af` (no top margin) | as above |
| Level 1 **active** (1A "Overview"; 2 "API Platform", expanded) | 14px / 600 | `#0860D4` `--w-primary-darkest`; chevron also `#0860D4` | background `rgba(43,140,247,0.12)`, radius 8 | No (Acrylic ListItemButton selected uses `action.selected`, MUI default `rgba(0,0,0,0.08)` in light mode: a neutral grey tint, not blue) |
| Nested group rail | | | margin-left 12, padding-left 12, border-left 1px `#e5e7eb`, gap 2 | 12 Half |
| Level 2 leaf ("Sign Up and Sign In", "Quick Start") | 13.5px / 400 | `#4b5563` `--grey-600` | padding 6 12 (28 high), radius 8 | 13.5 No (body2 13); padding 6 No |
| Level 2 **active** (2: "Overview" under API Platform) | 13.5px / 600 | `#0860D4` | background `rgba(43,140,247,0.12)`, radius 8 | No |
| Level 2 category ("Design and Deploy" expanded; "Secure and Govern", "Developer Portal" collapsed) | 13.5px / 600 when expanded, 400 when collapsed | `#374151` | padding 6 12, **no radius**, chevron 15 `#9ca3af` | No |
| Level 3 leaf ("Create an API" ...) | 13.5px / 400 | `#4b5563` | second rail (margin-left 12, padding-left 12, border-left 1px `#e5e7eb`), padding 6 12, radius 8 | as level 2 |
| Section divider | | `#e5e7eb` | 1px high, margin 20 12 | No (20 off grid) |
| Section label ("PLATFORM") | 11px / 700 / uppercase / letter-spacing 0.08em (0.88px) | `#9ca3af` `--grey-400` | padding 0 12 8 (21 high) | 11 Yes (caption size); 700 MUI; colour No |

Notes: the active parent and active child are both filled (2 shows "API Platform" and its "Overview" both highlighted). Collapsed categories in the "Platform" group use weight 500; collapsed categories above the divider use 600. Chevron colour follows the row colour only when active.

## Breadcrumbs

| Property | Mockup 1 | Mockup 2 | Oxygen |
|---|---|---|---|
| Row | flex, gap 8, 13px, `#6b7280` `--grey-500`, margin-bottom 28 | same, margin-bottom 26, `flex-wrap: wrap` | 13 Yes (body2 size); gap 8 Grid; 28 Half; 26 No |
| Home | lucide `house` icon 16, `#6b7280` | same | n/a |
| Separator | "/" `#9ca3af` | same | Oxygen uses `text.disabled`; colour No |
| Parent items | n/a (only Home / Overview) | "Platform", "API Platform": 13px / 400 `#6b7280` | Oxygen: `text.secondary`; colour No |
| Current item | "Overview" 13px / **500** `#111827` | same | **No**: Oxygen MuiBreadcrumbs sets the last item to weight 700 |

## Page title and lead text

| Element | Mockup 1 | Mockup 2 | Oxygen |
|---|---|---|---|
| h1 | **38px** / 1.15 (43.7px) / 700, letter-spacing -0.02em (-0.76px), `#111827`, margin-bottom 16 | **36px** / 1.15 (41.4px) / 700, -0.02em (-0.72px), `#111827`, margin-bottom 18 | **No**: Oxygen h1 is 28px / 400 / MUI line height 1.167 |
| Lead paragraph | 17px / 1.65 (28.05px) / 400, `#4b5563`, margin-bottom 20, max-width 720, `text-wrap: pretty` | 16px / 1.7 (27.2px) / 400, `#374151`, margin-bottom 18, `text-wrap: pretty` | 16 Yes (h5 size, weight differs); 17 No; line heights No |

## Body type scale

| Role | Mockup 1 | Mockup 2 | Oxygen |
|---|---|---|---|
| Body paragraph | 15px / 1.7 (25.5px) / 400 `#4b5563`; margins 20, 24 or 32 below | 15px / **1.75** (26.25px) / 400 `#4b5563`; margins 18 or 32 | **No**: body1 14px / 1.5 |
| h2 | **26px** / normal / 700, -0.01em (-0.26px), `#111827`, margin-bottom 8; 48 above (previous block's margin) | **24px** / normal / 700, -0.01em (-0.24px), `#111827`, margin-bottom 12; 34 to 44 above | 24px Yes (h2 size) for 2 only; 26 No; weight 700 No (h2 400) |
| h3 and below | not used | not used | not specified by the design |
| Bold lead-in inside list items | 15px / 600 `#111827` | same | 600 No |
| Card title | 16px / 600 `#111827` (platform cards); 15px / 600 (Labs, Solutions) | 15px / 600 (Next steps cards) | 16 Yes (h5 size); 15 No; 600 No |
| Card body | 14px / 1.6 (22.4px) `#4b5563` | 13.5px / 1.6 (21.6px) `#4b5563` | 14 Yes (body1 size); 13.5 No; 1.6 No |
| Inline link | 14px `#0A75F4` `--w-primary-darker`, no underline, `cursor: pointer` (inside the info note) | same (inside the tip) | No colour match; no underline matches Acrylic MuiLink |
| Code | none in 1A/1B | none | not specified |

## Lists

Only unordered lists appear; they are built from divs, not `ul`.

| Property | Values (both mockups) | Oxygen |
|---|---|---|
| Item layout | flex, gap **12** between marker and text, items aligned to the top | 12 Half |
| Marker | 6 x 6 circle, `#2B8CF7` `--w-primary`, margin-top 9 | colour No |
| Item spacing | gap **14** between items | No |
| Text | 15px / 1.7 / 400 `#4b5563`, bold lead-in 600 `#111827` | as body |
| List block | 1: max-width 760, margin-bottom 48. 2: full width, margin-bottom 34 | 48 Grid; 34 No |
| Ordered lists, nested lists | not in 1A/1B | not specified |

## Buttons

| Button | Values | Oxygen |
|---|---|---|
| Primary ("Start Building", 1 only) | inline-flex, height **40**, padding 0 18, radius **999** (pill), background `#2B8CF7` `--w-primary`, text white 14.5px / 600, gap 8; no icon | Shape: Yes in effect (Oxygen Button radius 20 on a 40px button renders as a pill); height 40 Grid; colour **No** (Acrylic gradient orange, WSO2 `#FF7300`); 14.5 / 600 No (button 14 / 500, Acrylic 400) |
| Footer outline pill ("Open the Cloud Console") | inline-flex, padding 6 12 (30 high), border 1px `rgba(255,255,255,0.18)`, radius 999, 13px / 600 white, lucide `external-link` 14, gap 8 | radius as above; colours No |
| Header icon buttons | see Header | |

## Cards

| Card | Values | Oxygen |
|---|---|---|
| Platform card (1, grid of 5) | background white, border 1px `#f3f4f6` `--grey-100`, radius **12** `--radius-md`, shadow `0 1px 3px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.03)` `--shadow-card`, padding **22**, flex column, gap 8; 386 wide, 158.8 high | Radius Yes (Acrylic `shape.borderRadius` 12; No for WSO2Theme 20); shadow **No** (Oxygen shadows are `none`); border colour No (divider); padding No |
| Card grid | 2 equal columns, gap 16, margin-bottom 48 | Grid |
| Icon tile | 32 x 32, radius 8, icon 18, tinted per platform: API `rgba(43,140,247,.12)` / `#0A75F4`; Agent `rgba(139,92,246,.12)` / `#6d28d9`; Integration `rgba(16,185,129,.14)` / `#047857`; Analytics `rgba(245,158,11,.15)` / `#b45309`; Identity `rgba(85,104,196,.14)` / `#5568c4`; gap 10 to title | radius Yes (8); colours No |
| Card link | "Open documentation" 13px / 600 `#0A75F4`, margin-top 4 | 13 Yes (body2 size); colour No |
| Labs / Solutions card (1) | no background, same border, radius 12, shadow, padding 20; title 15 / 600, margin-bottom 6; body 14 / 1.6 | as above |
| Next steps card (2) | same border, radius 12, shadow; padding 18; grid 2 columns gap 14, margin-bottom 44 | padding No |
| Hover | not specified (see method) | |

## Admonitions

| Kind | Values | Oxygen |
|---|---|---|
| Info (1, "Where you land depends ...") | flex, gap 16, padding **18 20**, radius **12**, background `rgba(43,140,247,0.07)`, border-left **4px** `#2B8CF7`; icon lucide `info` 18 `#0A75F4`, margin-top 2; text 14px / 1.65 (23.1px) `#374151`; no title; inline link `#0A75F4` | Radius Yes (12, Acrylic); colours No (info.main `#0288d1` / `#0277bd`); 14 Yes (body1 size) |
| Tip (2) | flex, gap 14, padding **16 18**, radius **8** `--radius-sm`, background `#f0fdf4` `--status-bg-success`, border-left 4px `#047857` `--status-ok`; icon lucide `circle-check-big` 18 `#047857`; title "Tip" inline 600 then a line break; text 14px / 1.65 `#374151`; margin-bottom 34 | Radius Yes (8); colours No (success.main `#2e7d32`); 600 No |
| Note, warning, danger | not in 1A/1B | not specified |

The two specimens disagree with each other on radius (12 vs 8), padding and gap; whoever builds the component must pick one.

## Figures and captions (2 only)

| Part | Values | Oxygen |
|---|---|---|
| Image placeholder | 300 high, full width (728), background `#f9fafb`, border **1px dashed** `#d1d5db` `--border-strong`, radius 12, flex column centred, gap 8, margin-bottom 12; lucide `image` 26 `#9ca3af`; label 13px `#6b7280` | radius Yes (12); colours No |
| Caption | "Figure 1 — ..." 12.5px / normal / 400 `#6b7280`, left aligned, margin-bottom 34 (below the figure by 12) | **No**: caption 11px / 1.66 |

The dashed box stands for an image; it says nothing about how a real image is framed (border, radius, shadow). Treat the radius 12 and grey background as the only signals.

## On this page (2 only)

| Part | Values | Oxygen |
|---|---|---|
| Column | 252 wide, border-left 1px `#f3f4f6` `--border-subtle`, padding **36 24 40 8**; static (not sticky in the mockup) | No |
| Heading | "On this page" 11px / 700 / uppercase / letter-spacing 0.08em (0.88px), `#9ca3af`, margin-bottom 12 | 11 Yes (caption size); 700 MUI; colour No |
| List | border-left **2px** `#e5e7eb` rail, gap 2 | No |
| Item | 13.5px / 400 `#4b5563`, padding 5 12 (26 high) | No |
| Active item | 13.5px / 600 `#0860D4`, own border-left 2px `#2B8CF7` drawn over the rail (margin-left -2) | No |
| Depth | only h2 entries; no nested h3 entries shown | not specified |

## Last updated and edit link (2 only)

| Part | Values | Oxygen |
|---|---|---|
| Row | flex, `space-between`, border-top 1px `#e5e7eb`, padding-top 20, margin-bottom 20; 44 above it (Next steps grid margin) | No (20) |
| Last updated | "Last updated on 5 August 2026" 13px / 400 `#6b7280` (left) | 13 Yes (body2 size) |
| Edit link | "Edit this page" 13.5px / 500 `#0A75F4` with lucide `pencil` 15 before it, gap 7 (right) | 500 Yes (medium); 13.5 No; colour No |

## Previous / next (2 only)

| Part | Values | Oxygen |
|---|---|---|
| Layout | grid, 2 equal columns (356 each), gap 16 | Grid |
| Card | border 1px `#e5e7eb` `--w-border`, radius **8**, padding 16 (1rem), line height 1.25, no background, no shadow; Next is right aligned | radius Yes (8); padding Grid |
| Label | "Previous" / "Next" 13.6px (0.85rem) / 500 `#6b7280`, margin-bottom 4 | 500 Yes; 13.6 No |
| Title | "« Support" / "Quick Start »" 17.6px (1.1rem) / 700 `#2B8CF7` `--w-primary`, guillemets in the text | No |

These two blocks are the only rem-sized parts of the page (with the footer), which suggests they were modelled on Docusaurus's own pagination styles; not verified.

## Footer (both mockups identical)

| Part | Values | Oxygen |
|---|---|---|
| Band | background `#0A1F44` `--w-navy`, text `rgba(255,255,255,0.85)`, padding 48 28 24 (3rem 28px 1.5rem) | No |
| Inner | max-width 1180, centred | n/a |
| Grid | `2fr 1fr 1fr 1fr`, gap 32 (2rem); brand column 434, link columns 217 | Grid |
| Brand column | flex column, gap 14, padding-right 32; logo 30 x 30 radius 6 white with navy "W" 16px / 700 / -0.02em; blurb 14.72px (0.92rem) / 1.6 `rgba(255,255,255,0.7)`, max-width 320; then the outline pill button | No |
| Column heading | "Docs", "Platform", "More": 13.6px (0.85rem) / 700 / uppercase / letter-spacing 0.08em, white, margin-bottom 16 | 700 MUI; size No |
| Links | 14.72px (0.92rem) / normal / 400 `rgba(255,255,255,0.78)`, gap 8 (0.5rem); plain text, no underline. Docs: What is WSO2 Cloud, Get Started, Manage Organizations, Manage Users, Billing and Pricing. Platform: the five platforms. More: Community Forum, GitHub, Status, Blog, Contact Support | No |
| Bottom bar | margin-top 40, padding-top 24, border-top 1px `rgba(255,255,255,0.12)`, 13.6px `rgba(255,255,255,0.55)`, centred: "Copyright © 2026 WSO2 LLC. All rights reserved. · Privacy Policy · Terms of Use ..." | No |

Link targets in the footer follow the map's decision (hub plan), not the design.

## Accent colours in use (1A and 1B)

| Colour | Token | Used for |
|---|---|---|
| `#2B8CF7` | `--w-primary` | primary button, list markers, info border, ToC active rail, prev/next titles; base of the active tint `rgba(43,140,247,0.12)` |
| `#0A75F4` | `--w-primary-darker` | inline links, card links, edit link, info icon, active theme toggle icon, API icon |
| `#0860D4` | `--w-primary-darkest` | active sidebar and ToC text |
| `#0A1F44` | `--w-navy` | logo, brand text, footer band |
| `#047857` / `#f0fdf4` | `--status-ok` / `--status-bg-success` | tip |
| `#111827`, `#374151`, `#4b5563`, `#6b7280`, `#9ca3af`, `#d1d5db`, `#e5e7eb`, `#f3f4f6`, `#f9fafb` | Tailwind gray scale | text, borders, surfaces |

None of these equals an Oxygen palette value. Oxygen's primary is orange in every theme (`#fa7b3f` Acrylic, `#FF7300` WSO2), and Oxygen inherits MUI's grey scale (`#fafafa`, `#f5f5f5`, `#eeeeee`, `#e0e0e0`, `#bdbdbd`, `#9e9e9e`, `#757575`, `#616161`, `#424242`, `#212121`), which shares no value with the Tailwind grays the design uses.

## Tally: design values against Oxygen 0.16.0

Counted over the distinct values in the tables above (spacing counted per distinct number, colours per distinct colour, type per size/weight pair):

| Category | Match (Yes or MUI) | Grid / Half spacing | No match |
|---|---|---|---|
| Colours (distinct, including tints) | 1 (`#ffffff` page background, WSO2Theme only) | n/a | about 30 |
| Font family | 0 | n/a | 1 (system stack vs Inter Variable) |
| Font sizes (distinct: 11, 12.5, 13, 13.5, 13.6, 14, 14.5, 14.72, 15, 16, 17, 17.6, 18, 24, 26, 36, 38) | 6 sizes equal an Oxygen variant size (11, 13, 14, 16, 18, 24), usually on a different variant and weight | n/a | 11 |
| Font weights (400, 500, 600, 700) | 3 (400, 500 medium, 700 bold) | n/a | 1 (600, used widely) |
| Line heights (1.15, 1.6, 1.65, 1.7, 1.75, 1.25, normal) | 0 | n/a | 7 |
| Radii (4, 6, 8, 12, 999) | 3 (8 ListItemButton/OutlinedInput; 12 Acrylic shape; 999 behaves as Oxygen's 20 on 40px buttons) plus 4 as an MUI default both themes override | n/a | 1 (6) |
| Shadows (card) | 0 | n/a | 1 (Oxygen has no shadows) |
| Spacing (distinct: 2, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 34, 36, 40, 44, 48, 56, 64) | n/a | 8 on the 8px grid (8, 16, 24, 32, 40, 48, 56, 64) and 6 on the 4px half-step (4, 12, 20, 28, 36, 44) | 11 (2, 5, 6, 7, 9, 10, 14, 18, 22, 26, 34) |
| Component behaviour | breadcrumbs separator/parent roles match Oxygen's pattern | n/a | breadcrumb current weight (500 vs 700), active sidebar tint (blue vs `action.selected`), link colour |

In short: **structure, sizes and radii are largely expressible with Oxygen (radius 8 and 12, 8px spacing, several MUI type sizes); colour, font family, heading weights, line heights and shadows are not.**

## Conflicts with Oxygen (Oxygen wins, per the map)

1. **Primary colour**: design blue `#2B8CF7` family against Oxygen orange (`#fa7b3f` Acrylic default, `#FF7300` WSO2Theme). Every accent above flips.
2. **Font**: design renders the system stack (and carries an unused Ubuntu Sans token); Oxygen uses Inter Variable.
3. **Heading scale and weight**: design h1 36 to 38 / 700, h2 24 to 26 / 700; Oxygen h1 28 / 400, h2 24 / 400. Body 15px / 1.7 against Oxygen body1 14px / 1.5.
4. **Shadows**: design cards carry `--shadow-card`; Oxygen sets all 25 MUI shadows to `none` (Acrylic cards rely on border plus translucent background and blur).
5. **Radius**: design mixes 8 (nav, inputs, tip, prev/next) and 12 (cards, info note, figure); Acrylic shape is 12 with 8 for list buttons and inputs, which fits; WSO2Theme shape is 20, which does not fit cards.
6. **Neutrals**: Tailwind gray against MUI grey and Oxygen text colours (`#40404B` or `#181818`); borders `#e5e7eb` against divider `#00000012`.
7. **Breadcrumb current item**: 500 in the design, 700 in Oxygen's MuiBreadcrumbs override.
8. **Active nav state**: blue 12% tint with darkest-blue 600 text; Oxygen ListItemButton selected uses `palette.action.selected` (neutral) in Acrylic.
9. **Header surface**: 92% white with blur 8px; Oxygen AppBar (Acrylic) uses `#ffffff40` with blur 10px.
10. **Admonition colours**: info blue tint and success green `#047857` against Oxygen/MUI info `#0288d1` (or `#0277bd`) and success `#2e7d32`.

## Not specified by mockups 1 and 2

Hover, focus and pressed states for every element; sticky behaviour; h3 and smaller headings; ordered and nested lists; code (inline and block); tables; note/warning/danger admonitions; real image framing; ToC nesting; dark mode values for these frames (the theme toggle exists but only light is drawn); widths below 1440.

## Side findings for the Oxygen ticket (01)

- `@wso2/oxygen-ui@0.16.0` contains no `.css` file in its tarball although `package.json` `sideEffects` names `dist/styles/Themes/theme.css`. Any plan that imports `theme.css` needs checking.
- `OxygenUIThemeProvider` can load a theme from a same-origin URL and runs it with `new Function(...)` after a string check for `eval(`/`Function(`. That path needs `unsafe-eval` under a strict Content Security Policy and executes fetched code; the docs site should pass theme objects, not theme URLs. Flag for security review if the URL option is ever used.
- License: Apache-2.0 (package.json).

## Confidence

- **High**: every px, colour, weight and token name above for 1A and 1B (read from computed styles and inline styles in the rendered page).
- **High**: Oxygen values quoted from the 0.16.0 sources in the source map.
- **Medium**: MUI default values (line heights, grey scale, Toolbar 64, info/success mains, `action.selected`), which come from MUI's documented defaults rather than this package's files.
- **Not measured**: the system font resolves to SF Pro on macOS and to other fonts elsewhere, so text widths and "normal" line heights vary by platform.
