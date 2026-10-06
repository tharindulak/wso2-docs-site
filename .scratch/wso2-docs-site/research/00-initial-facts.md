# 00 Initial facts (researched 2026-10-06)

Sources: GitHub API via `gh` (authenticated) and official docs pages. Items marked **[unverified]** are inference or from prior knowledge, not confirmed in a primary source during this pass.

## 1. wso2/oxygen-ui

- **What:** "The Design System powering WSO2 products." README: "official design system and React component library for WSO2 products, built on top of Material-UI v7". `import { Button } from '@wso2/oxygen-ui'` is equivalent to `@mui/material`; it re-exports MUI plus WSO2 components, layouts, themes. https://github.com/wso2/oxygen-ui
- **License:** Apache-2.0. Repo is active (last push 2026-10-06; 64 stars). Docs/Storybook: https://wso2.github.io/oxygen-ui
- **Latest release:** `@wso2/oxygen-ui@0.15.0` (2026-10-01); 0.14.0 on 2026-09-23. Pre-1.0, releases roughly weekly via changesets, so expect API churn.
- **npm packages:** `@wso2/oxygen-ui`, `@wso2/oxygen-ui-icons-react` (wraps lucide-react), `@wso2/oxygen-ui-charts-react` (recharts 3.3), plus tooling `@wso2/vite-plugin-oxygen-ui`, `@wso2/eslint-plugin-oxygen-ui`, `@wso2/esbuild-plugin-inline-css-fonts`.
- **Deps (pnpm catalog):** @mui/material 7.3.4, @mui/x-data-grid/date-pickers 8.x, @emotion/react 11.14, React/React-DOM 19.2.3 (peer via catalog), Inter variable font. React 19 is the target; React 18 compatibility **[unverified]**.
- **Tokens / CSS variables:** Theme built with MUI `extendTheme({ cssVarPrefix: 'oxygen', colorSchemes: { light, dark } })` (`packages/oxygen-ui/src/styles/OxygenThemeBase.ts`). So it emits `--oxygen-*` CSS variables **at runtime through MUI/Emotion**. No standalone tokens package or static CSS file is shipped (only `fonts.css`, `icons.css`). Using the tokens outside React would mean extracting/generating them yourself **[inference]**.
- **Dark mode:** Yes. `colorSchemes` light + dark; ships `ColorSchemeToggle`, `ColorSchemeImage`. Multiple themes: WSO2Theme, Classic, HighContrast, Acrylic*, Pale*.
- **SSR:** README documents Emotion cache, CSP nonce, SSR guidance ("Keep server and client Emotion caches aligned"). It notes Oxygen UI "does not ship" MUI's `InitColorSchemeScript`, which is what normally prevents dark-mode flash on SSR **[implication inferred]**.
- **Docusaurus usage:** None found. Code search found `@wso2/oxygen-ui` only in wso2/agent-manager, wso2/integration-control-plane, wso2/reference-implementation-cms0057f. No `docusaurus.config.*` in the org references it.
- **Conflicts to plan for:**
  - Docusaurus has no first-class CSS-in-JS SSR hook. https://github.com/facebook/docusaurus/issues/3236 ("CSS-in-JS Rendering Hooks") is still open, so Emotion SSR needs a swizzled Root/wrapper, with FOUC risk.
  - MUI CssBaseline / global styles vs Infima.
  - Two colour mode systems (Docusaurus `data-theme` vs MUI `colorSchemes`) need syncing **[inference]**.
- **Existing WSO2 Docusaurus sites (custom CSS, not Oxygen):**
  - wso2/docs-wso2cloud: Docusaurus 3.10.2, `@easyops-cn/docusaurus-search-local`. Its `src/css/theme.css` is "adapted from the WSO2 Agent Manager docs theme ... so the two sites share one look and feel."
  - wso2/docs-agent-platform: Docusaurus 3.10.2, `docusaurus-lunr-search`, llms-txt plugin. Its `versions.json` = `["v1.0.0","cloud"]`, a "cloud" pseudo-version alongside releases.
  - wso2/docs-integrator: Docusaurus 3.9.2, easyops local search.

## 2. Docusaurus

- **Current stable:** v3.10.2 (2026-07-10). 3.10.0 (2026-04-07) is "the last release in the v3.x line"; v4 is not released (4.0 canaries exist). 3.10 adds React 19 support; v4 will drop React 18. Docusaurus Faster (Rspack/SWC/LightningCSS) is stable and will be default in v4. 3.10 also adds a "git-eager" strategy that fixes per-file `git log` build bottlenecks. https://github.com/facebook/docusaurus/releases, https://docusaurus.io/blog/releases/3.10
- WSO2 agent-platform config disables `future.v4` because of a bug where "near-identical versioned docs" break with v4 enabled. Worth knowing for a heavily versioned site.
- **(a) Multi-instance:** One `@docusaurus/plugin-content-docs` per product, each with a unique `id`, `path`, `routeBasePath` and `sidebarPath`. Navbar items (`docSidebar`, `docsVersionDropdown`, `docsVersion`) take `docsPluginId`, so each product gets its own sidebar and version dropdown. The docs caution that very large instances may be better as separate sites. https://docusaurus.io/docs/docs-multi-instance
- **(b) Versioning:**
  - Per instance. `npm run docusaurus docs:version:<pluginId> X` copies the docs into `<id>_versioned_docs/version-X/` and `<id>_versioned_sidebars/`, then appends to `<id>_versions.json`. Each version is a full copy of its files.
  - Options: `lastVersion`, `onlyIncludeVersions`, and per-version `label`, `path`, `banner` (`unreleased`/`unmaintained`) and `badge`.
  - Docs guidance: "try to keep the number of your versions below 10", and limit to 2 or 3 versions in dev and previews. Build time and memory scale roughly with total pages × versions × locales **[scaling characterisation inferred]**.
  - https://docusaurus.io/docs/versioning
- **(c) Search:**
  - **Algolia DocSearch:** free program for "public technical documentation"; open source is not required. Commercial vendor docs are typically accepted, but approval is at Algolia's discretion **[unverified for WSO2]**. Ineligible sites need a paid Algolia plan (pricing not checked). https://docsearch.algolia.com/docs/who-can-apply/
  - **Contextual search:** on by default. Docusaurus emits a `docusaurus_tag` of `docs-${pluginId}-${versionName}` (verified in `packages/docusaurus-plugin-content-docs/src/client/docsSearch.ts`), so results are filtered to the active/preferred version **of every docs instance**. Scoping to the current product only needs extra facet filters or a custom SearchBar **[inference]**. https://docusaurus.io/docs/search
  - **Typesense** (`docusaurus-theme-search-typesense` v0.27.0, 2026-08-26, MIT): DocSearch-compatible scraper + UI, so it gets the same tag-based contextual search. Self-hostable.
  - **@easyops-cn/docusaurus-search-local** (v0.55.3, 2026-07-29): has `docsPluginIdForPreferredVersion` (only **one** instance), `docsRouteBasePath[]`, `searchContextByPaths` (separate index per path, e.g. per product) and Ask AI. Known gaps:
    - Issue #544 (open, 2025-11): with multi-instance plus versions, "search will be unavailable for all versions except latest version".
    - Issue #304 (open): results mix across versions.
    - Indexes are downloaded to the browser, so size grows with pages × versions.
  - **docusaurus-lunr-search:** used by agent-platform; similar client-side limits **[unverified detail]**.
- **(d) i18n:**
  - Built in. Translations live in `i18n/<locale>/<plugin>/`, and docs are translated per version. Each locale is a separate build (cost multiplies versions × locales). Supports Git or Crowdin workflows, RTL and hreflang. https://docusaurus.io/docs/i18n/introduction
  - The docs-is `base.yml` has RTL-related branches (e.g. `fix-rtl-locale`), so some locale work exists today **[unverified scope]**.
- **(e) MkDocs Material to MDX concerns [from knowledge; verify per feature]:**
  - **Admonitions:** `!!! note "Title"` becomes `:::note[Title]`, and `??? note` (collapsible) becomes `<details>`.
  - **Tabs:** `=== "Tab"` (pymdownx.tabbed) becomes `<Tabs><TabItem>` (MDX import).
  - **Snippets/includes:** `--8<--` and `{% include %}` become MDX partial imports (`_partial.mdx`). Partials take props, not Jinja variables.
  - **Macros:** `{{ var }}`, `{% if %}` and markdownextradata variables have no direct equivalent. They need constants or props or a custom remark plugin.
  - **Other syntax:** `attr_list` `{: .class}`, `pymdownx.critic/keys/mark/caret/tilde` and emoji shortcodes have no native support.
  - **MDX v3 strictness:** bare `<` and `{` in prose break the build. A `.md` file with `format: 'detect'` is parsed as CommonMark, but then has no JSX.

## 3. developer.hashicorp.com

- **Global navigation:** Products dropdown (grouped "Infrastructure Lifecycle Management" / "Security Lifecycle Management") and a Learn section. https://developer.hashicorp.com/vault
- **Per-product sub-navigation (Vault):** Install, Tutorials, Documentation, Agentic AI, CLI, APIs, HCP Vault Dedicated, Integrations, Sandbox. The product landing page carries use cases, getting-started paths and certifications.
- **Versioning:**
  - The docs carry a version selector per product and doc set, e.g. "v2.x (latest)", v1.21.x … v1.4.x, with a note that the page didn't exist before v1.16.x. URLs look like `/vault/docs/v1.21.x/...`. The code has `docs-version-switcher` and `version-alert-banner` components (hashicorp/dev-portal, MPL-2.0).
  - Sidebar badges `ENT` and `BETA` mark Enterprise-only or beta features.
  - https://developer.hashicorp.com/vault/docs
- **Cloud vs self-managed:**
  - **Terraform:** split into separate doc sets. HCP Terraform at `/terraform/cloud-docs` is **unversioned**. Terraform Enterprise at `/terraform/enterprise` is **versioned** (2.0.x latest, 1.2.x, plus dated releases v202507-1 …).
  - **Shared content between them:** the Enterprise docs say "HCP Terraform and Terraform Enterprise are different distributions of the same application. When this documentation refers to HCP Terraform, the information applies to Terraform Enterprise unless specifically stated otherwise." https://developer.hashicorp.com/terraform/enterprise
  - **Vault:** "HCP Vault Dedicated" is a separate sub-nav entry and doc set, distinct from self-managed Vault docs.
- **Search:**
  - Unified Algolia command-bar search with tabs: All (global), Docs, Tutorials, Integrations. See `src/components/command-bar/commands/search/unified-search` and `get-algolia-filters.ts` (filters by `type:`).
  - Inside a product it pre-applies the current product tag (`get-current-product-tag.ts`), which can presumably be removed for global search **[UI behaviour inferred from code]**.
  - Whether search indexes all versions or latest only: **[unverified]**.

## 4. GitLab docs (docs.gitlab.com)

- **Availability details:** a Hugo shortcode under the H1.
  ```
  {{< details >}}
  - Tier: Free, Premium, Ultimate
  - Offering: GitLab.com, GitLab Self-Managed, GitLab Dedicated
  - Status: Beta
  {{< /details >}}
  ```
  - **Tier values:** `Free, Premium, Ultimate` / `Premium, Ultimate` / `Ultimate`.
  - **Offering values:** any combination of GitLab.com, GitLab Self-Managed, GitLab Dedicated, GitLab Dedicated for Government.
  - **Status:** Beta / Experiment / Limited availability; omitted for GA.
  - **History:** a separate `{{< history >}}` block ("Introduced in GitLab 16.3.").
  - **Where to use:** add to most H1s and to sections whose availability differs. Avoid on tutorials and comparison pages. Remove history for unsupported versions.
  - https://docs.gitlab.com/development/documentation/styleguide/availability_details/
- **Versioning:**
  - Site built with Hugo. Each release gets an `X.Y` branch deployed at `docs.gitlab.com/X.Y/`.
  - Kept online: the 3 most recent minors plus the last minor of the previous 2 majors. Older versions go to `archives.docs.gitlab.com/X.Y/`.
  - `content/versions.json` currently = next 19.5, current 19.4, last_minor 19.3/19.2, last_major 18.11/17.11.
  - The root site is built from main, i.e. the "next" (pre-release) docs. That matches GitLab.com's continuous deploys, while self-managed users pick a numbered version **[root = next is inferred from versions.json, not explicitly stated]**.
  - Cloud and self-managed share a single page. Differences are expressed via the Offering line, history notes and inline text, not separate doc sets.
  - https://gitlab.com/gitlab-org/technical-writing/docs-gitlab-com/-/blob/main/doc/releases.md, https://docs.gitlab.com/development/documentation/site_architecture/

## 5. Current WSO2 docs tooling (MkDocs)

All three repos use MkDocs + mkdocs-material **9.1.2** (pinned, old), with `mkdocs-redirects`, `markdownextradata`, glightbox and pymdownx. None uses `mike`.

- **wso2/docs-is** (default `master`):
  - **Version folders on master:** `en/identity-server/{5.9.0,5.10.0,5.11.0,6.0.0,6.1.0,7.0.0,7.1.0,7.2.0,7.3.0,next}/mkdocs.yml`. Each config `INHERIT`s `is_common.yml` → `en/base.yml`, with `site_url` like `https://is.docs.wso2.com/en/7.3.0` and `extra.is_version`.
  - **Cloud docs alongside:** `en/asgardeo/mkdocs.yml` (unversioned).
  - **Single-sourcing:** 896 files under `en/includes/` are shared. Per-product/version wrapper pages do `{% set product_name = "WSO2 Identity Server" %}` then `{% include ".../includes/guides/..." %}`; the Asgardeo wrapper sets `"WSO2 Identity Platform"`. Includes branch with `{% if ... product_name == "WSO2 Identity Platform" %}` and `{{base_path}}`.
  - **Plugins and hooks:** mkdocs-include-markdown-plugin 6.0.0, `hooks.py` and `flatten_markdown.py`; `product-toggle.js` in the theme.
  - **Legacy branches:** older version branches also exist (5.9.0 … 6.1.0).
- **wso2/docs-apim** (default `master`):
  - **Branch per version:** 3.0.0 … 4.7.0 branches. master has a single `en/mkdocs.yml` with `site_url: https://apim.docs.wso2.com/en/4.7.0/` and `site_version: 4.7.0`.
  - **Fixes:** fan out as per-version branches (`fixing-issue-N-4.x.0-...`).
- **wso2/docs-mi** (default `main`):
  - **Branch per version:** 4.2.0 … 4.6.0 branches. main has `en/mkdocs.yml` (`site_url: https://mi.docs.wso2.com/en/latest/`, site_name "WSO2 Integrator: MI Documentation 4.7.0").
  - **Version switcher:** a hand-maintained `en/docs/versions/assets/versions.json` lists versions with external URLs per version. It still says current = 4.6.0, so it looks stale versus 4.7.0.
  - **Fixes:** same per-version branch fan-out.
- **Implication [inference]:** IS already single-sources cloud + on-prem via Jinja includes and variables. This is the hardest part to port to MDX (see 2e).
