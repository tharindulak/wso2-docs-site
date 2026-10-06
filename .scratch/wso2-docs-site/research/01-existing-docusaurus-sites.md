# 01 How the existing WSO2 Docusaurus sites are built (researched 2026-10-06)

Answers [issue 01](../issues/01-existing-docusaurus-sites.md). Sources: the default branch (`main`) of each repo, read via the GitHub API (`gh api repos/wso2/<repo>/contents/...` and `git/trees/HEAD?recursive=1`) on 2026-10-06. Paths below are relative to the repo root. Anything marked **[inference]** is my reading, not stated in a source. Secrets and keys are masked.

Repos:
- https://github.com/wso2/docs-wso2cloud (homepage field `http://docs.wso2.com/cloud`, last push 2026-09-28)
- https://github.com/wso2/docs-agent-platform (homepage `https://wso2.com/agent-platform/docs`, last push 2026-10-06)
- https://github.com/wso2/docs-integrator (no homepage field, last push 2026-10-06)

All three are Apache-2.0, so code and CSS can be reused freely inside WSO2 with attribution headers kept.

## 1. Summary table

| | docs-wso2cloud | docs-agent-platform | docs-integrator |
|---|---|---|---|
| Docusaurus | 3.10.2 (+ `@docusaurus/faster`) | 3.10.2 | 3.9.2 |
| `future.v4` | `true` | `false` (Faster MDX bug with near-identical versions) | `true` |
| Site root | repo root | repo root | `en/` (npm scripts run `docusaurus <cmd> en`) |
| Docs routing | preset docs at `/docs` | preset docs at `/` under `baseUrl: /agent-platform/docs/` | preset docs at `/`, `baseUrl` from `BASE_URL` env |
| Docs instances | 1 | 1 | 1 |
| Versioning | none | Docusaurus versioning: `current` (Next), `v1.0.0`, `cloud` | none at site level; custom per-connector versions |
| Search | `@easyops-cn/docusaurus-search-local` ^0.55.3 | `docusaurus-lunr-search` ^3.6.0, plus swizzled Algolia DocSearch with runtime fallback (forced to lunr today) | `@easyops-cn/docusaurus-search-local` ^0.55.1 |
| Other plugins | none | llms-txt, client-redirects, theme-mermaid, GTM noscript | theme-mermaid, 3 local plugins |
| Swizzles | none | `DocItem/Layout`, `Navbar/Content`, `SearchBar` | `Root`, `CodeBlock/Content`, `DocBreadcrumbs`, `DocSidebar/Desktop`, `DocSidebarItems`, `MDXComponents/A`, `MDXComponents/Img` |
| CSS | `custom.css` + `theme.css` (port of AMP theme) | `custom.css` + `amp-theme.css` | single `custom.css` (own Inter/slate design) |
| Hosting in repo | Dockerfile + nginx, WSO2 Cloud CI (`.cicd/`) | GitHub Pages via Actions | GitHub Pages via `gh-pages` branch; Vercel PR previews |
| Size (docs files) | ~8 pages | 89 Next, 87 v1.0.0, 53 cloud | ~1,159 `.md/.mdx` |

## 2. docs-wso2cloud

**Config** (`docusaurus.config.ts`, `package.json`)
- Docusaurus 3.10.2 with `@docusaurus/faster` 3.10.2, React ^19, TypeScript ~6.0.2, Node >= 20.
- `future: { v4: true }`.
- `url: 'https://TODO-production-docs-host.example'` with a comment: production host "not yet confirmed. The same image is promoted dev -> stage -> prod, so this must be the prod URL." `baseUrl: '/'`.
- `onBrokenLinks: 'throw'`. i18n `en` only. Blog off.
- Classic preset, docs at `routeBasePath: 'docs'`, `customCss: ['./src/css/custom.css', './src/css/theme.css']`.
- Search theme `@easyops-cn/docusaurus-search-local` with `hashed: true`, `docsRouteBasePath: 'docs'`, `indexBlog: false`, `indexPages: false`.
- Navbar: one `docSidebar` item and a GitHub link. No version dropdown. Footer, prism github/dracula.
- `src/pages/index.tsx` is a `<Redirect>` to `/docs/get-started/what-is-wso2-cloud`.

**Content and sidebar** (`sidebars.ts`, `docs/`)
- Explicit sidebar `docsSidebar`: Get Started, Manage (organization, users-and-roles, billing, project, data-planes, environments), Support, Hosting environment details, Architecture.
- Top-level entries use `className: 'sidebar-section-icon-*'` to get the section-header styling and masked icon from `theme.css` (same convention as agent-platform).

**Theme** (`src/css/theme.css`, 666 lines)
- Header: "Adapted from the WSO2 Agent Manager docs theme (github.com/wso2/docs-agent-platform, src/css/amp-theme.css, Apache-2.0) so the two sites share one look and feel. Loaded after custom.css."
- Defines a WSO2 orange primary ramp (`--ifm-color-primary: #fa7b3f`, lifted ramp under `[data-theme='dark']`), system font stack, sidebar section headers. Pure Infima variable overrides plus CSS, no React.
- `custom.css` (93 lines) holds site-only tweaks (navbar logo, wordmark).

**CI and hosting** (`.cicd/wso2cloud-docs.yaml`, `Dockerfile`, `nginx.conf`, `README.md`)
- `.cicd/wso2cloud-docs.yaml`: `type: docker`, triggers on `docs/**`, `src/**`, `static/**`, config and Docker files; pushes to an AWS ECR repo (`<acct-masked>.dkr.ecr.us-east-2.amazonaws.com/system/wso2cloud-docs`) and updates a workload at `controlplane/common/domains/developers/namespaces/wso2cloud/projects/core/components/wso2cloud-docs/workload.yaml`. This is WSO2 Cloud's own internal deployment pipeline, not GitHub Actions. There is no `.github/workflows/`, so no PR build check **[observed absence]**.
- `Dockerfile`: `node:20-alpine` build stage (`npm ci && npm run build`, explicitly not under `/workspace` because "the CI Kaniko build mounts that path"), then `nginx:1.27-alpine` with patched OS packages "so the Trivy scan does not block", non-root UID 10001 (`choreouser`; "The platform requires a UID between 10000 and 20000"), port 8080.
- `nginx.conf`: `try_files $uri $uri/index.html $uri.html =404` (no SPA fallback), `Cache-Control: no-cache` for HTML, one-year immutable caching for `/assets/`, gzip, `server_tokens off`, `absolute_redirect off`.
- README: "WSO2 Cloud CI builds the image ... and deploys it as the `wso2cloud-docs` component" and "keep environment-specific settings out of the build" except `url`.
- Live check: `https://docs.wso2.com/cloud` returned HTTP 403 from Cloudflare (bot challenge) for `curl`, so the live host could not be verified.

## 3. docs-agent-platform

**Config** (`docusaurus.config.ts`, `package.json`)
- Docusaurus 3.10.2, React ^19, TypeScript ~5.6.2, Node >= 20. No `@docusaurus/faster`.
- `future.v4: false`, comment: "on Docusaurus 3.10.2, v4:true pulls in the Rust-based Faster bundler, which has a build-breaking MDX compilation bug when several near-identical versioned docs are processed together (confirmed via bisection against getting-started/on-a-vm.mdx's 5 version copies, reproducible only with v4 enabled)."
- `url: 'https://wso2.com'`, `baseUrl: '/agent-platform/docs/'`, `trailingSlash: true`, `onBrokenLinks: 'throw'`, `markdown.mermaid: true`, `onBrokenMarkdownLinks: 'warn'`.
- `customFields: { latestVersion, searchProvider: 'lunr' }`.
- `headTags`: CookiePro consent stub loaded before Google Tag Manager (GTM container ID present; public, not a secret). `plugins/gtm-noscript.ts` injects the GTM `<noscript>` iframe via `injectHtmlTags().preBodyTags`.
- Plugins: `@signalwire/docusaurus-plugin-llms-txt` ^1.2.2; `docusaurus-lunr-search` with `excludeRoutes: ['next', 'next/**']` ("Next is unreleased and noindexed"); `@docusaurus/plugin-client-redirects` (see 3.3); local `gtmNoscriptPlugin`.
- Themes: `@docusaurus/theme-mermaid`.
- Docs preset: `routeBasePath: '/'`, `lastVersion: latestVersion`, `showLastUpdateAuthor/Time: true`, `editUrl` to the repo, `customCss: ['./src/css/custom.css', './src/css/amp-theme.css']` with "Order matters ... Do not reorder."
- `themeConfig`: announcement bar driven by `latestVersion` (links to the `amp/<version>` tag in wso2/agent-manager); `algolia` block with `appId` (`HGUI…`), search-only `apiKey` (`5499…` masked), `indexName: 'Agent Manager Documentation Site (Docusaurus)'`, `contextualSearch: true`, `askAi.assistantId`; navbar with `docSidebar` and `docsVersionDropdown`; `colorMode.respectPrefersColorScheme`.
- `package.json` has `audit` script (`audit-ci --config .audit-ci.jsonc`, fails on high/critical production advisories, one allowlisted GHSA with written justification) and ~30 `overrides` pinning patched transitive deps.
- `lucide-react` is a dependency (icons in components).

### 3.1 The "cloud" pseudo-version

How it is implemented:
- `versions.json` = `["v1.0.0", "cloud"]`.
- Content lives in `versioned_docs/version-cloud/` (53 files) with `versioned_sidebars/version-cloud-sidebars.json`, alongside `versioned_docs/version-v1.0.0/` (87 files) and Next in `docs/` (89 files).
- It was added by hand, not by `docusaurus docs:version`. Commit `20bcf1b` ("docs: add Cloud version to Docusaurus config", 2026-05-20) changed only `docusaurus.config.ts` (+6/-1), added `versioned_sidebars/version-cloud-sidebars.json` and appended `"cloud"` to `versions.json`. CLAUDE.md calls it "the hand-maintained `cloud` version".
- `docusaurus.config.ts` picks the latest release by skipping non-semver entries: `versions.find(v => /^v\d+/.test(v)) ?? versions[0]` ("Skip non-release entries like "cloud" which are manually maintained versions"). That value drives `lastVersion`, the announcement bar, footer links and redirects.
- Version options: `cloud: { label: 'Cloud', banner: 'none', path: 'cloud' }`, `current: { label: 'Next', banner: 'unreleased' }`, `[latestVersion]: { label, path: latestVersion }`. So URLs are `/agent-platform/docs/cloud/...`, `/agent-platform/docs/v1.0.0/...`, `/agent-platform/docs/next/...` **[`next` path is the Docusaurus default for `current`; inferred]**.
- Client redirects: `/cloud`, `/next`, `/<latest>` and `/latest` each redirect to `.../get-started/what-is-amp`; `createRedirects` maps every `/<latest>/...` page to a `/latest/...` alias.
- `src/css/custom.css` styles it as a distinct entry in the version dropdown: `.dropdown__link[href*="/docs/cloud"] { color: #fa7b3f; border-left: 3px solid #fa7b3f; font-weight: 600; }`.

How it is maintained:
- Edits go directly into `versioned_docs/version-cloud/`. Commit history of the cloud sidebar shows manual updates: "Update cloud documentation to add plans and pricing" (2026-06-02), "update the cloud docs to current state" (2026-08-19), "Remove on prem specific sections" (2026-08-20).
- Cloud is a subset of Next: every cloud file path also exists in `docs/`; 36 Next pages are absent from cloud (quick-start, CLI reference, Helm chart reference, install guides on k3d/VM, isolation tiers, guardrails, contributing, etc.). Of the 38 shared page paths, 12 are byte-identical to Next and 26 differ (compared by git blob SHA). So the cloud docs are a forked copy with self-hosted sections removed, not single-sourced.
- The release tooling ignores it: `Makefile` `version` target runs `docusaurus docs:version`, regenerates the Helm reference into the new snapshot, and rewrites `v0.0.0-dev` placeholders; `update-version` deletes and re-cuts one version. `.github/workflows/docs-release.yml` wraps these and opens a PR. Neither touches `cloud`.
- Consequences **[inference]**: (a) cloud fixes must be manually ported from Next and vice versa; drift is already visible (26 diverging files). (b) Docusaurus treats "cloud" as an older version in the dropdown and `docsVersion` ordering. (c) Search: lunr indexes all versions except `next`, so cloud and v1.0.0 results mix **[inferred from config; not tested]**.

### 3.2 Theme swizzles and components
- `src/theme/Navbar/Content/index.tsx` (ejected, 207 lines): renders the color toggle and search on the right, and chooses a search provider. If `customFields.searchProvider === 'lunr'` it always renders the lunr bar (`@theme-original/SearchBar`). Otherwise `AutoSearchBar` probes `https://<appId>-dsn.algolia.net/1/indexes` with a 5 s timeout and falls back to lunr, caching the decision in `localStorage` (comment says 10 minutes; constant is 60 min). Today the config forces lunr, so the Algolia path is dormant.
- `src/theme/SearchBar/index.tsx` (ejected, 313 lines): a copy of the theme-search-algolia DocSearch SearchBar (DocSearch v4 props, Ask AI). Imported as `@theme/SearchBar` for the Algolia branch.
- `src/theme/DocItem/Layout/index.tsx` (ejected): adds `DocMarkdownActions` next to breadcrumbs.
- `src/components/DocMarkdownActions/`: "copy page as Markdown / open Markdown / open in external AI" dropdown (uses `lucide-react`), paired with the llms-txt plugin.
- `src/css/amp-theme.css` (1,013 lines): numbered sections (primary ramp, typography, page background, layout, sidebar chrome, sidebar section headers, navbar/TOC, code blocks, docs landing, responsive). This is the parent of docs-wso2cloud `theme.css`.
- `src/pages/index.tsx` is a marketing-style landing page; `src/pages/docs/index.tsx` exists too.

### 3.3 CI and hosting (`.github/workflows/`)
- `deploy.yml`: on push to `main` (with `paths-ignore` for README, `.github/**`, `.claude/**` etc.) and manual dispatch. `fetch-depth: 0` for last-update author. Node 20, `npm ci`, `npm run build`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`. `concurrency: pages`, no cancel.
- `pr-checks.yml`: on PR and `merge_group`: `npm ci`, `npm run audit`, `npm run build` (fails on broken links).
- `docs-release.yml`: manual, inputs `version`, `docker_tag`, `recreate`; checks the `amp/<tag>` tag exists in wso2/agent-manager, runs `make version`/`update-version`, verifies placeholders and `_constants.md`, ensures Next Helm docs untouched, builds, opens a PR.
- `pr-open-notify.yml`: Google Chat webhook via `pull_request_target`, explicitly never checks out PR code.
- GitHub Pages: `gh api repos/wso2/docs-agent-platform/pages` → `build_type: workflow`, `html_url: https://wso2.github.io/docs-agent-platform/`, no CNAME. The built HTML at that URL has `og:url` `https://wso2.com/agent-platform/docs/`. So `wso2.com/agent-platform/docs/` is presumably a Cloudflare/edge proxy to GitHub Pages **[inference; proxy config is not in the repo, and the wso2.com URL returned a Cloudflare 403 challenge to curl]**.
- `docs/_constants.md` exports `versions.latestVersion` and `quickStartDockerTag`, read both by MDX and by `docusaurus.config.ts` (regex).
- Repo also carries `.claude/skills/docs/*` and `CLAUDE.md` with authoring rules ("Any technical claim must be verified against the wso2/agent-manager source").

## 4. docs-integrator

**Config** (`en/docusaurus.config.ts`, root `package.json`)
- Docusaurus 3.9.2, React ^19, TypeScript ~5.6.2, `linkinator` dev dep, Node 20 (`en/.nvmrc`).
- npm project at repo root, site dir `en/` (scripts are `docusaurus build en`, etc.). Build output `en/build`.
- `future.v4: true`. `url: 'https://wso2.com'`, `baseUrl: process.env.BASE_URL || '/'`, `trailingSlash: false`, `onBrokenLinks: 'warn'` (looser than the other two), mermaid on.
- Docs preset at `routeBasePath: '/'`, `editUrl` to `.../tree/main/en/`, `showLastUpdateTime: true`, single `customCss: './src/css/custom.css'`.
- Search: `@easyops-cn/docusaurus-search-local` with `hashed`, `highlightSearchTermsOnTargetPage`, `explicitSearchResultPath`, `docsRouteBasePath: '/'`, `indexPages: true`.
- `themeConfig.docs.sidebar.autoCollapseCategories: true`; navbar has only the logo and a GitHub link (section navigation comes from the custom `SiteNav`).
- Footer links out to the MkDocs MI/SI sites (`mi.docs.wso2.com`, `si.docs.wso2.com/latest/`).

**Local plugins**
- `en/src/plugins/connector-versions.js`: walks `en/docs` for `versions.json` files with `connector_name` and publishes `{versions, latest, shared}` as global data. Example `en/docs/connectors/catalog/communication/twilio/versions.json`: `{"connector_name":"twilio","versions":["5.0.x","4.0.x"],"latest":"5.0.x","shared":["setup-guide"]}`, with the older version's pages in a `4.0.x/` subfolder. This is per-component versioning inside an unversioned site, used by `DocBreadcrumbs` via `src/utils/connectorVersion.js`.
- `en/src/plugins/expose-sidebars/index.js`: in `allContentLoaded`, resolves the docs plugin's sidebars to permalinks and exposes them as global data, so non-doc pages (homepage drawer) render the same tree as `sidebars.ts`. It reads only `allContent['docusaurus-plugin-content-docs'].default` and `loadedVersions[0]`, so it assumes one unversioned docs instance **[inference from code]**.
- `en/plugins/docusaurus-plugin-markdown-export/` (`index.js`, `mdxProcessor.js`): emits a Markdown copy of each doc at build time (used by the "copy as Markdown" button in breadcrumbs).

**Swizzles** (`en/src/theme/`)
- `Root.js`: registers a custom Prism `ballerina` language and adds `<SiteNav />` around every page; also a DOM-manipulating hook that sets navbar active state and clicks sidebar toggles to collapse non-active top-level categories (hard-coded section list).
- `CodeBlock/Content` (ejected): `// docs-fold-start` / `// docs-fold-end` code folding.
- `DocBreadcrumbs` (wrapped, 361 lines): connector category tags, connector version switcher, `MarkdownButton`.
- `DocSidebar/Desktop`, `DocSidebarItems` (latter a no-op wrapper).
- `MDXComponents/A` + `Img` + `AnchorContext`: images not inside a link become click-to-open links.
- Components: `ConnectorCatalog`, `ProductDocsLinks`, `SiteNav`, `TabAwareToc` (hides TOC entries for headings in inactive tabs).
- `custom.css` (870 lines): own design ("Clean Modern Theme", slate neutrals, primary `#0077B6`, accent orange, Inter from Google Fonts via `@import`). It does not use the AMP orange ramp (no `#fa7b3f`). So there are two visual languages across the three sites today.

**Content structure**
- ~1,159 `.md/.mdx` under `en/docs`. Cloud vs self-hosted is split by folder within one unversioned tree: `deploy/cloud`, `deploy/self-hosted`, `manage/cloud`, `manage/icp`. No versioning of the product docs at all.
- `en/sidebars.ts` is 3,004 lines, explicit.

**CI and hosting** (`.github/workflows/`)
- `publish_docs.yaml`: push to `main` → `npm ci`, `npm run build` with `BASE_URL: /integration-platform/docs/`, deploy `en/build` with `peaceiris/actions-gh-pages@v4` to the `gh-pages` branch. Pages: `build_type: legacy`, branch `gh-pages`, `html_url: https://wso2.github.io/docs-integrator/`, no CNAME. Built with the `/integration-platform/docs/` base, so like agent-platform it is presumably served through a `wso2.com` proxy **[inference]**.
- `pr_build_check.yaml`: title-case enforcement script, build (with `BASE_URL: /docs-integrator/`), non-blocking orphan-page check.
- `broken-link-check.yaml` + `broken-link-comment.yaml`: build PR head and base, crawl both with linkinator, comment introduced-vs-existing broken links; actions pinned by SHA.
- `pr_preview.yaml`: manual Vercel preview per PR, with a deliberate split: build job checks out fork code with no secrets (`npm ci --ignore-scripts`), deploy job has `VERCEL_TOKEN` but only consumes the artifact. Good pattern to copy.
- `claude_runner.yml` (hourly cron + issue comments) and `auto_label.yml`: AI agent that picks up labelled issues and opens PRs; calls the Anthropic API with a repo secret **[flag: AI-generated doc PRs need human review; secret handling not audited here]**.

## 5. What the new docs site can reuse

Directly reusable (Apache-2.0, low coupling):
1. **Container hosting from docs-wso2cloud**: `Dockerfile` + `nginx.conf` + `.cicd/*.yaml` is already wired to WSO2 Cloud CI (Kaniko, Trivy, ECR, non-root UID 10001). If the unified site is hosted on WSO2 Cloud, this is the starting point. Keep "one image promoted dev→stage→prod" and the "only `url` is env-specific" rule.
2. **Theme layer**: `amp-theme.css` / `theme.css` (orange ramp, sidebar section headers via `sidebar-section-icon-*` classNames). Already shared by two sites; it is plain Infima overrides, so it composes with multi-instance docs. Integrator's design would need a decision (converge or keep per-product accent) **[inference]**.
3. **CI hygiene from agent-platform**: `pr-checks.yml` (audit-ci + build with `onBrokenLinks: 'throw'`), `deploy.yml` concurrency/paths-ignore, `.audit-ci.jsonc`, `overrides` approach.
4. **CI from integrator**: linkinator before/after broken-link diff comment, orphan-page check, title-case check, and the secret-isolated Vercel preview workflow.
5. **AI/LLM affordances**: `@signalwire/docusaurus-plugin-llms-txt` + `DocMarkdownActions` (agent-platform), or integrator's markdown-export plugin + `MarkdownButton`. Pick one.
6. **Small components**: Ballerina Prism language and code folding (`Root.js`, `CodeBlock/Content`), image-link wrapper, `TabAwareToc`, client-redirects pattern for `/latest/` aliases, GTM noscript plugin + CookiePro ordering (needs privacy/legal sign-off for the new domain).
7. **Release automation**: `docs-release.yml` + `Makefile` (cut version, substitute placeholders, open PR). Must be made per-plugin (`docs:version:<pluginId>`) for a multi-instance site.

Reuse with care or avoid:
- **The "cloud" pseudo-version pattern**: it works with stock Docusaurus but is a hand-forked copy that already diverges from Next, sits in the version dropdown as if it were a release, and is skipped by all tooling. For a site that must document WSO2 Cloud and Self-hosted per product, this is the main design question for the map **[inference]**. Alternatives seen elsewhere: integrator's folder split (`deploy/cloud` vs `deploy/self-hosted`) in one unversioned tree; HashiCorp's separate unversioned cloud doc set; GitLab's single page with an availability line (see [00 initial facts](00-initial-facts.md) §3–4).
- **Search**: three different setups. Agent-platform already has an Algolia app, index and Ask AI assistant configured but switched off in favour of lunr; the reason is not stated in the repo **[unverified]**. easyops local search has known multi-instance + version gaps (00 §2c). The Navbar provider-probe swizzle sends the Algolia key from the browser to check reachability; fine for a search-only key, but adds an ejected component to maintain.
- **`future.v4`/Faster**: agent-platform turned it off due to an MDX bug with near-identical versioned copies; wso2cloud and integrator have it on. A multi-product, versioned site should test this early.
- **Ejected (not wrapped) swizzles**: agent-platform `Navbar/Content`, `SearchBar`, `DocItem/Layout` and integrator `CodeBlock/Content` are full copies of theme internals and will need re-syncing on Docusaurus upgrades (v4).
- **Integrator `Root.js` DOM manipulation** and `expose-sidebars` assume a single unversioned docs instance; both need rework for multi-instance.
- **Hosting split**: two sites go to GitHub Pages behind (presumably) a wso2.com proxy, one to WSO2 Cloud via containers. No hosting or proxy config for wso2.com is in any repo.

## 6. Gaps / not verified
- Live production URLs (`docs.wso2.com/cloud`, `wso2.com/agent-platform/docs/`, `wso2.com/integration-platform/docs/`) all returned Cloudflare 403 challenges to curl; proxy and CDN config were not visible.
- Why Algolia is disabled on agent-platform, and whether WSO2 holds a DocSearch (free) or paid Algolia plan.
- Build times and memory for each site were not measured.
- Integrator `claude_runner.yml` / `auto_label.yml` were only skimmed.
