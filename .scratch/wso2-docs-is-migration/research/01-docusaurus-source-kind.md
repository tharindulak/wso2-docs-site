# 01 What the `docusaurus` source kind needs to carry Identity Platform (researched 2026-10-13)

Answers [issue 01](../issues/01-docusaurus-source-kind.md) of the [map](../map.md). Planning input for human review.

Sources:
- Docs site code in the main checkout `/Users/admin/Documents/wso2/Wso2-Cloud/docs-site` as of 2026-10-13, including uncommitted changes (read only). Paths below are relative to `docs-site/`; line numbers are from that state and will drift.
- Cached content sources under `docs-site/.cache/sources/` (docs-is at `c2176fcd1b50`, docs-agent-platform at `58da5a82a4d1`).
- Docusaurus primary docs: [Versioning](https://docusaurus.io/docs/versioning), [plugin-content-docs API](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs), [MDX and React: importing Markdown](https://docusaurus.io/docs/markdown-features/react), [Table of contents](https://docusaurus.io/docs/markdown-features/toc).

Anything marked **[inference]** is my reading, not stated by a source. **[verify]** means a prototype should confirm it.

## 1. What `kind: docusaurus` does today

`scripts/build-content.mjs` `buildSection` (lines 52-73) sends any section that is not `mkdocs` or `mkdocs-merge` to `prepareDocusaurusDocs` (`packages/docs-converter/src/site.ts` lines 545-581) with `root`, `docs`, `sidebar`, `current_site`, an edit URL, the `SHIMS` map, `deployment_options` and `deployment_overrides`. Per page it:

1. Walks every `.md`/`.mdx` file under `<root>/<docs>`, including `_`-prefixed partials (line 548).
2. Replaces shimmed import paths (line 555), rewrites root image paths `](/img|images|assets/...` and `src="/img..."` to `/<route>/...` (line 556), and rewrites `.mdx` link targets and relative `.mdx` imports to `.md` (lines 557-558), since pages are written as `.md`.
3. Writes front matter `{ ...source, deployment_options: source ?? lock default/override, custom_edit_url: <edit URL> }` (line 560). Page front matter wins for `deployment_options`; the edit URL always overwrites.
4. Compile-checks with MDX 3; on a compile error falls back to CommonMark (`mdx: { format: 'md' }`) and strips imports (lines 562-571).
5. Goes through `emit` (lines 263-284): exclude list, failure report and redirect fallback, and `keepMkdocsUrl` slug pinning, the same as MkDocs sections.

Then it copies non-page files of the docs folder to both the output and the static folder (lines 574-575), copies `<dirname(docs)>/static` to the static folder (lines 576-577), and loads the sidebars file, keeping **only the first sidebar id** (lines 578-579). A `.js`/`.ts` sidebars file is executed through `jiti` (lines 519-526).

Everything after conversion is kind-independent: `fillTemplatePages`, `rewriteLinksToHostedPages` (aliases, former_site, current_site), `versions.json`/`pages.json`, `older_versions` selector entries, `former_route` redirects, exclude-list maintenance (`--onboard`, `--prune`).

The site (`site/docusaurus.config.js`) runs one docs plugin per version and leaves Docusaurus's number-prefix parser on only for `kind: docusaurus` (line 41).

Lock-file shape: `scripts/versions.mjs` `sectionVersions` (lines 40-80) already lets any section list `versions:` with per-version `docs`, `sidebar`, `sparse`, `skip`, `deployment_overrides` and `exclude` (line 56). Non-Latest entries are forced to `deployment_options: [Self-hosted]`, lose `aliases`, `cloud_companion` and section-level overrides, and take `current_site` from `former_site` with `{version}` (lines 74-78).

## 2. Docusaurus facts that bear on the tree

- Layout: frozen versions live in `versioned_docs/version-<name>/`, sidebars in `versioned_sidebars/version-<name>-sidebars.json`, and `versions.json` lists names newest first; `docs/` is the `current` version ([Versioning](https://docusaurus.io/docs/versioning)).
- Assets: versioned assets go inside the version's docs folder with relative paths; global assets go in `/static` with absolute paths ([Versioning](https://docusaurus.io/docs/versioning)). So `static/` is shared by all versions **[inference from the guidance; the page does not say so outright]**.
- Imports: "Don't use relative paths import within the docs", use `@site` instead ([Versioning](https://docusaurus.io/docs/versioning)). This targets component imports from docs into the site; a partial copied inside each version folder still resolves relatively **[inference]**.
- Partials: "using the `_` filename prefix will not create any doc page" ([MDX and React](https://docusaurus.io/docs/markdown-features/react)). Default plugin `exclude` is `**/_*.{js,jsx,ts,tsx,md,mdx}`, `**/_*/**`, tests ([plugin-content-docs](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs)).
- TOC: built "by parsing the Markdown source with a Remark plugin" ([TOC](https://docusaurus.io/docs/markdown-features/toc)); headings inside imported partials are therefore not in the importing page's TOC **[inference; see facebook/docusaurus#6201; verify]**.
- Number prefixes: `numberPrefixParser: false` leaves file names untouched; per page `parse_number_prefixes` front matter exists ([plugin-content-docs](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs)).
- Native doc front matter includes `slug`, `custom_edit_url`, `hide_title`, `pagination_next/prev`, `sidebar_*`, `description`, `keywords`, `unlisted`, `draft`. `deployment_options`, `mkdocs_template` and `quick_start` are not native; Docusaurus passes unknown keys through to `frontMatter` (the site reads `deployment_options` in `site/src/theme/DocItem/Content/index.js` line 9).
- Version options `lastVersion`, `onlyIncludeVersions`, `versions.<v>.{label,path,banner,badge,noIndex}` exist, but the docs site does not use Docusaurus versioning at all: it builds each version as its own plugin instance with only a `current` version (config lines 31-44). So the tree's `versions.json` is never read by Docusaurus here.

## 3. Facts about the docs-is source today

- Includes: 1,054 pages in `en/asgardeo/docs` and `en/identity-server/7.3.0/docs` use `{% include %}`; shared includes live in `en/includes/` (outside any docs folder).
- MkDocs `redirect_maps` entries: Asgardeo 69, IS 7.3.0 298, 7.2.0 297, 7.1.0 1, 7.0.0 287, 6.1.0 610, 6.0.0 610, 5.11.0 8, 5.10.0 9, 5.9.0 9 (counted from each `mkdocs.yml`).
- Assets: `asgardeo/docs/assets` 543 MB, `identity-server/7.3.0/docs/assets` 589 MB, `5.9.0` 331 MB.
- No page or folder name under the docs folders starts with a number prefix; only some image files do (`01-dashboard-stable.png`), which the parser ignores.
- The lock's `identity` section carries `aliases` (`https://wso2.com/asgardeo/docs/`), `former_site`, `shared_names`, `older_versions` (5.0.0-5.8.0, Confluence) and per-version `exclude`; no `former_route`.

## 4. Gap list

Legend: **Supported** works for a `docusaurus` section today. **Missing** needs code in the docs site or converter. **Decision** needs a format choice first.

| # | Feature | Status | Evidence | What is needed |
|---|---|---|---|---|
| 1 | Several versions from `docs/` + `versioned_docs/` | **Supported, verbose** | `versions:` with per-version `docs`/`sidebar` overrides (`versions.mjs` line 56); each version becomes its own plugin instance | Each lock entry spells out `docs: docusaurus/versioned_docs/version-7.2.0`, `sidebar: docusaurus/versioned_sidebars/version-7.2.0-sidebars.json`, `sparse`. Works, but see #2. |
| 2 | Promotion: Latest moves into `versioned_docs/` when a new release is cut | **Missing + Decision** | `version_folder` (`versions.mjs` 35-38, `bump-lib.mjs` 77-84) only fills `mkdocs:`; the bump bot checks only `mkdocs`/`docs_root` folders (`bump-lib.mjs` 140-149) | A Docusaurus-layout pattern (for example `docusaurus_root: docusaurus/` from which Latest = `docs/`, others = `versioned_docs/version-{version}/` and their sidebars), or read `versions.json`. Decide which is the source of truth: lock `versions:` (pins sha per version) vs tree `versions.json`. Recommendation: lock stays authoritative (sha, exclude, live/snapshot), tree `versions.json` must match it, CI checks they agree. |
| 3 | Latest live, older as snapshots | **Supported** | `sectionVersions` status from `live_window` (line 50); snapshots key on the version's lock entry | Older versions can stay pinned to the sha they were generated at, so regenerating Latest does not rebuild every snapshot. |
| 4 | Static files | **Missing (bug) + Decision** | `staticSrc` = `<dirname(docs)>/static` (`site.ts` 576). For `versioned_docs/version-X` that is `versioned_docs/static`, which does not exist. Confirmed on Agent Manager: repo-root `static/img/WSO2-Logo.png` etc. are not in `generated/static/agent-manager/img/` | Fix: take the static folder from a lock field (`static: docusaurus/static`) or from the Docusaurus root. Decide shared `docusaurus/static/` vs per-version assets inside each `versioned_docs/version-X/` (Docusaurus guidance supports both). Note each snapshot gets its own `static-versions/<id>` copy anyway (`build-content.mjs` 109); and the docs folder's own assets are copied twice, to output and static (`site.ts` 574-575), which at 330-590 MB per version matters. |
| 5 | Deployment options per page | **Supported** | Front matter `deployment_options` wins over lock default (`site.ts` 560) | Tree carries `deployment_options` in every page's front matter (the generator already writes it, `page.ts` 133). Lock keeps the section default as a fallback only. |
| 6 | `<Applies>` / `<DeploymentValue>` blocks | **Supported, Decision on imports** | Converter writes `import Applies from '@site/src/components/Applies'` per page (`page.ts` 140-141); the docusaurus path passes imports through | Decide: keep per-page `@site/src/components/...` imports (works today, but ties authored MDX to docs-site paths and breaks any standalone preview) or register them globally in `site/src/theme/MDXComponents` (today it overrides only `A`) so pages need no import. Either way the contributor guide (ticket 08) names the allowed components. |
| 7 | "Cloud" section flag (older-version banner wording) | **Missing** | Manifest sets `cloud` only for `mkdocs-merge` or `cloud_companion` (`build-content.mjs` 261); `OlderVersionBanner.js` line 13 uses it | Derive `cloud` from Latest's `deployment_options` including WSO2 Cloud, or add a lock flag. Without it the banner on 7.2.0 and older loses "Self-hosted ... For WSO2 Cloud ...". |
| 8 | `former_site` | **Supported** | Used for non-Latest `current_site` (`versions.mjs` 77), Latest link rewriting incl. `/en/latest/` (`build-content.mjs` 147, 155), `formerOrigin` (113-118) | Stays in the lock. |
| 9 | `aliases` | **Supported** | `build-content.mjs` 154 (Latest only) | Stays in the lock. |
| 10 | Latest answering for two current sites (Asgardeo and is.docs) | **Supported via lock fields** | `mkdocs-merge` adds both `cloud` and `self_hosted` `current_site` (line 151); `docusaurus` adds one `current_site` plus `former_site` for Latest's version and aliases | Set `current_site: https://wso2.com/identity-platform/docs/`; is.docs 7.3.0 and `/en/latest/` come from `former_site`; `https://wso2.com/asgardeo/docs/` from `aliases`. Check no other is.docs form is lost. |
| 11 | `former_route` redirects | **Supported** | `build-content.mjs` 290-303, kind-independent | Stays in the lock; IS has none today. |
| 12 | `older_versions` links | **Supported** | `confluenceEntries` (`build-content.mjs` 257-258) | Stays in the lock. |
| 13 | MkDocs `redirect_maps` (old page URLs) | **Missing + Decision** | Written only by `convertMkdocsSite` (`site.ts` 433-443). `convertMergedSites` does not write them either, so IS Latest (Asgardeo 69 + IS 7.3.0 298) already has none today; older IS versions (kind `mkdocs`) do | Decide a format the tree carries, for example `docusaurus/redirects.json` per version (old path -> new path), or front matter on the target page. The docs site then writes the pages with the existing `writeRedirectPages`. This is per-version content, so it belongs in the tree, not the lock. |
| 14 | Exclude lists | **Supported, Decision on meaning** | `emit` handles `exclude` for every kind; fallback target is `current_site + rel` without trailing slash (`site.ts` 572), unlike MkDocs URLs (`foo/`) | For a generated tree the generator should not write excluded pages (or write them so they fail), and the lock's `exclude` keeps working as today. Fix the fallback URL (trailing slash, and Self-hosted-only pages should go to is.docs, not the Asgardeo site). Goal per map: empty lists. |
| 15 | MDX partials (Latest) | **Partly supported** | Partials inside the docs folder are copied and relative `.mdx` imports rewritten (`site.ts` 548, 558); Agent Manager's `_constants.md` works | Missing: (a) partials outside the docs folder (`docusaurus/partials/`, the analogue of `en/includes/`) are not copied, so they must live under `docs/` (for example `docs/_partials/`); (b) partials get front matter added and are listed as pages in `pages.json` (`generated/static/agent-manager/pages.json` has `"_constants/"`), so the version selector can link to a page that does not exist: `pagePaths` and the link-rewrite `hosts` must skip `_` files and `_*/` folders; (c) the CommonMark fallback strips imports (`site.ts` 568), silently dropping partial content; (d) TOC omits partial headings [verify]. Decision: partials folder location and whether a partial may carry front matter. |
| 16 | Compile failure handling | **Decision** | Fallback to CommonMark (`site.ts` 562-571) | For an owned, CI-checked tree, a compile failure should fail (or go to the exclude list), not degrade quietly. Lock flag or kind variant. |
| 17 | HTML allow-list | **Missing** | `prepareDocusaurusDocs` runs only `compileCheck`; the policy (`applyHtmlPolicy`) runs only on MkDocs pages (`page.ts`) | Security: once writers hand-edit MDX after cutover, nothing on the docs-site side enforces the allow-list (no `<script>`, event handlers, `javascript:` URLs, arbitrary iframes, arbitrary `@site`/package imports). The fork's CI check (ticket 03/08) covers PRs to the fork; the docs site should also run the same check on `docusaurus` sources as defense in depth. |
| 18 | Edit links | **Decision** | `custom_edit_url` always overwritten with the file in the content repo (`site.ts` 560) | Until cutover the tree is generated only, so "Edit this page" should point at the MkDocs source (`en/...`), or be off. Either the generator writes `custom_edit_url` and the converter stops overwriting an existing value, or a lock flag selects. |
| 19 | Template pages (`mkdocs_template`) and `quick_start` | **Supported / inert** | `fillTemplatePages` runs for every kind on `mkdocs_template` front matter (`build-content.mjs` 79-100); `quick_start` is written but nothing in `site/` reads it | Better: the generator writes the overview body itself so the tree is self-contained. `quick_start` can be dropped or kept as data. |
| 20 | Sidebars | **Supported, constraint** | Only the first sidebar id is used (`site.ts` 579); `.js`/`.ts` sidebars are executed (`site.ts` 519-526) | Tree uses one sidebar per version, as JSON (`sidebars.json` for Latest, `versioned_sidebars/*.json`), so no content-repo code runs at build time. |
| 21 | Number prefixes | **Low risk, Decision** | `numberPrefixParser` default for `docusaurus` kind (config line 41) | No IS page or folder has a number prefix today. Decide whether the generator guarantees that, or the lock gets `number_prefixes: false`. |
| 22 | Image paths | **Supported, constraint** | Only `/img`, `/images`, `/assets` root paths are rewritten to `/<route>/` (`site.ts` 556); `relativeImages` is not applied | Generator should write page-relative image paths (Docusaurus's versioned-assets guidance), which survive copying to `versioned_docs/` on promotion and need no route. |
| 23 | Links between pages | **Decision** | MkDocs path writes absolute `/<route>/...` links (`resolveBase`); the docusaurus path only rewrites `.mdx` -> `.md` | Absolute `/identity/7.2.0/...` links bind the tree to docs-site routes and break on promotion. Prefer relative `.md` file links (Docusaurus resolves them per version). |
| 24 | Reading from the fork | **Missing for CI** | `repoOk` allows owner `wso2` only; `DOCS_SITE_TEST_OWNER` works locally and is ignored when `CI` is set (`lib.mjs` 13-15) | Ticket 10 proof runs locally with `DOCS_SITE_TEST_OWNER=tharindulak`, or the branch needs a reviewed CI exception. Keep the CI restriction (supply-chain). |

## 5. Front matter / files in the tree vs the lock file

Carried by the generated `docusaurus/` tree (content; changes with the pages):
- Per page front matter: `title`, `deployment_options`, `slug` (pinned MkDocs URLs), `description`/`keywords`, `hide_title`/`hide_table_of_contents` where the generator sets them, `custom_edit_url` (until cutover, pointing at `en/`).
- Per page body: `<Applies>`, `<DeploymentValue>`, `Tabs`, partial imports (imports or global components per decision #6).
- Files: `docs/`, `versioned_docs/version-<v>/`, `sidebars.json` + `versioned_sidebars/version-<v>-sidebars.json` (JSON), `versions.json`, `static/` (or per-version assets, decision #4), partials under `docs/_partials/` (decision #15), and a per-version redirects file (decision #13).

Kept in the lock (`content-sources.yaml`; deployment and history, not content):
- `repo`, per-version `sha`/`ref`/`track`, `sparse`, the version list and its order, `exclude`, `live_window` behaviour.
- `route`, `label`, `current_site`, `former_site`, `aliases`, `former_route`, `older_versions`, `product_repo`, `release_tag`.
- Section default `deployment_options` (fallback only) and the new fields this list proposes: the Docusaurus root or layout pattern (#2), the static folder (#4), and optionally `cloud` (#7), strict compile (#16) and edit-link mode (#18).
- `shared_names` and `self_hosted`/`cloud` sub-objects go away (the generator consumes them).

## 6. Open points to verify by prototype

- Front matter inside an imported partial is ignored by the importing page, and partial headings are missing from the TOC.
- A version built from `versioned_docs/version-X` with relative partial imports and relative image paths compiles in its own plugin instance under `generated/docs/<id>/`.
- Docusaurus with `numberPrefixParser` on produces the same URLs as MkDocs for every IS page.
