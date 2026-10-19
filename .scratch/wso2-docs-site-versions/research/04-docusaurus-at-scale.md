# 04 Docusaurus at 40+ versions: build time, memory and snapshot options (researched 2026-10-09)

Answers [issue 04](../issues/04-docusaurus-at-scale.md).

Sources: docusaurus.io docs and release notes, facebook/docusaurus issues and discussions, and the config files of real multi-version Docusaurus sites read with `gh api` (fetched 2026-10-09). **[inference]** marks my reasoning; **[unverified]** marks claims not confirmed in a primary source. No site build was run.

## TL;DR

- **The documented limit is advice, not a hard cap.** Docusaurus says "try to keep the number of your versions below 10" and recommends archiving older versions "as external links to immutable URLs from previous production builds" so they are not rebuilt on every deploy. Docusaurus, Jest and React Native all do exactly this. https://docusaurus.io/docs/versioning
- **Cost grows with total pages (docs x versions x locales).** There is no page-level incremental build. Reports: 9,719 MDX files needed about 22 to 23 GB RSS even with Docusaurus Faster (Camunda, 2026-10-05); 11k files took 75 minutes on 16 cores/64 GB before tuning; 12k+ files ran out of heap. The maintainer's advice for very large sites is to split into smaller linked sites.
- **For this site:** about 5,900 pages already take 15 to 50 minutes with an 8 GB heap and Faster disabled. 25,000+ pages in one build is about 4x the pages. **[inference]** One build with every version is not viable without Faster, and probably not within CI memory even with it.
- **Recommended shape [inference]:** build Latest plus a small window of recent versions live; build every frozen version once (from its pinned source) into static output and serve it beside the live site under the same URL scheme; link those versions from the version selector as plain (non-SPA) links. Search, navigation and link checking then need explicit handling (see §4).
- **Re-test Docusaurus Faster first.** It is the largest single lever (2 to 4x build speed, lower memory, SSG worker threads, persistent bundler cache), and the site currently disables it because of an Rspack failure on near-identical versioned MDX, which more versions will make more common.

## 1. What Docusaurus documents

- Versioning guide, "Keep the number of versions small": "try to keep the number of your versions below 10. You will very likely to have a lot of obsolete versioned documentation that nobody even reads anymore." https://docusaurus.io/docs/versioning
- Same page, archiving: for Jamstack hosts, archive older versions as external links to immutable URLs of previous production builds, and do not rebuild them on each deploy; "Both Jest and Docusaurus" follow this. https://docusaurus.io/docs/versioning
- Same page, build speed: use `onlyIncludeVersions` to "limit to 2 or 3 versions" in dev and preview deployments. https://docusaurus.io/docs/versioning
- Docs plugin options: `onlyIncludeVersions` ("Only include a subset of all available versions"), `lastVersion`, `includeCurrentVersion`, `disableVersioning`, and per-version `path`, `label`, `banner` (`none`/`unreleased`/`unmaintained`), `badge`, `noIndex`, `className`. https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs
- No documented page count or memory limit exists. Maintainer in Discussion #10895: "We haven't tested Docusaurus at various scales"; the largest community site he cited had about 4,000 pages; for 70k pages "a static site generator is not ideal" and he suggested splitting into smaller linked sites. https://github.com/facebook/docusaurus/discussions/10895
- Maintainer in Discussion #3132: "everytime you'll cut a new version you'll increase the build time"; "if your site has many docs, many versions, many languages, yes you will have large build times without splitting the site in smaller subsites." https://github.com/facebook/docusaurus/discussions/3132
- Umbrella issue "Performance - Reduce build time and memory usage" is still open (since 2021). https://github.com/facebook/docusaurus/issues/4765

## 2. Known reports on build time and memory

| Report | Size | Result | Source |
|---|---|---|---|
| Camunda docs (2026-10-05, Docusaurus 3.9.2, Faster on incl. Rspack, persistent cache, SSG workers) | 9,719 MDX files, 870 MB, 4 doc sets | Full build 4:28, peak 23.4 GB RSS; single version still about 22 GB. "Memory is driven by page count, not versions." "Version slicing saves time but not memory." "Docusaurus has no page-level incremental SSG." CI sets `--max-old-space-size=30720`. | https://github.com/camunda/camunda-docs/issues/10207 |
| SailPoint (2025) | about 11k files incl. OpenAPI pages | 75 min on 16 cores/64 GB, OOM on laptops. After maintainer tuning and 3.8 Faster flags: 480 s cold, 350 s warm. Heavy generated MDX (large embedded JSON) was a main cost. | https://github.com/facebook/docusaurus/discussions/11140 |
| Discussion #10895 (2025, 3.6.3) | target 70k files | Heap OOM from 12k files; with Faster, EMFILE and stack overflow errors; one user built 16,800 docs on WSL. | https://github.com/facebook/docusaurus/discussions/10895 |
| Discussion #3132 (2020) | 360 MDX x 2 versions | 26 min, 10 GB+, needed 16 GB heap; without versioning about 5 GB. | https://github.com/facebook/docusaurus/discussions/3132 |
| Issue #9754 (2024, 3.1) | 2,289 files x 2 locales | Broken link checker regression took builds to 3+ hours; fix cut one site from 137 to 41 min. Link checking is a real cost at scale. | https://github.com/facebook/docusaurus/issues/9754 |

Docusaurus Faster (3.6+): flags `swcJsLoader`, `swcJsMinimizer`, `swcHtmlMinimizer`, `lightningCssMinimizer`, `rspackBundler`, `mdxCrossCompilerCache`; "2 to 4 times faster" production builds, reduced memory and a fixed i18n memory leak. https://docusaurus.io/blog/releases/3.6 . 3.8 added `ssgWorkerThreads` (about 2x faster SSG, contains memory leaks) and `rspackPersistentCache` (about 2 to 5x faster rebundling); a ~2,000-page site built cold in 31 s. https://docusaurus.io/blog/releases/3.8 . `faster: true` enables all; `ssgWorkerThreads` requires `future.v4.removeLegacyPostBuildHeadAttribute`. https://docusaurus.io/docs/api/docusaurus-config

### This site today

- 15 docs sections, about 5,944 generated pages, one docs plugin instance per section, each with only `current` (`docs-site/site/docusaurus.config.js`).
- Full build 15 to 50 minutes depending on free memory; quick builds per section about 10 minutes for Integration Platform (`docs-site/README.md`).
- Heap set to 8 GB by `docs-site/scripts/docusaurus.mjs` (commit 9bae380) after Identity plus Integration ran out of the default heap.
- `future: { v4: false }` and no `faster`: "Faster bundler broke on near-identical versioned MDX in docs-agent-platform; re-test before enabling."
- `onBrokenLinks: 'warn'`.
- **[inference]** Going to 25,000+ pages is about 4.2x the current pages. With roughly linear scaling, one build would take about 1 to 3.5 hours and need well over 8 GB of heap. The Camunda figures (about 22 GB RSS at under 10k files, with Faster) suggest memory is the binding constraint, not time. A GitHub-hosted standard Linux runner has 16 GB RAM **[unverified, check current GitHub runner specs]**.

## 3. Option A: one build with all versions

- **Build time and memory:** grows with total pages; no incremental SSG, so every deploy (including the hourly content bump) rebuilds every frozen version. **[inference]** Not viable at 25k pages on standard runners; would need a large runner and Faster working.
- **Navigation:** native. Each section's docs instance gets a `docsVersionDropdown`, sidebars per version, `banner: 'unmaintained'` on old versions.
- **Search:** native contextual search; DocSearch facets on `docusaurus_tag` per version. https://docusaurus.io/docs/search
- **Version selector:** native, but 13 entries per section is a long list (React Native shows 11 live versions this way).
- **Broken links:** full checking across all versions, at a cost (issue #9754).
- **Mitigation inside A:** `onlyIncludeVersions` for dev, previews and quick builds, as Docusaurus and React Native do (`['current', ...versions.slice(0, 2)]` on deploy previews). https://github.com/facebook/docusaurus/blob/main/website/docusaurus.config.ts , https://github.com/facebook/react-native-website/blob/main/website/docusaurus.config.ts

## 4. Option B: build frozen versions once, serve the static output beside the live site

How others do it:

- **Docusaurus site:** `website/versions.json` keeps 12 live versions (3.10.2 back to 2.x). `versionsArchived.json` maps 2.0.1 to 2.3.1 to `https://docusaurus-archive-october-2023.netlify.app/docs/<v>`; the navbar version dropdown appends an "Archived versions" group with those `href` links, a link to `v1.docusaurus.io`, and an "All versions" page. Production uses Faster with Rspack and persistent cache. https://github.com/facebook/docusaurus/blob/main/website/versionsArchived.json , https://github.com/facebook/docusaurus/blob/main/website/docusaurus.config.ts
- **Jest:** 4 live versions; `archivedVersions.json` links 29.0 to 29.6 to `jest-archive-august-2023.netlify.app`. https://github.com/jestjs/jest/blob/main/website/archivedVersions.json
- **React Native:** 11 live versions; `versionsArchived.json` (17 entries) points to `reactnative-archive-august-2023` and `reactnative-archive-august-2025` deployments. https://github.com/facebook/react-native-website/blob/main/website/versionsArchived.json
- **Spectro Cloud:** three active versions built from per-release branches; older versions archived to a separate Netlify domain. https://www.spectrocloud.com/blog/when-docs-and-a-dinosaur-git-along-enabling-versioning-in-docusaurus
- **Apache Pulsar:** serves static pages generated outside Docusaurus (reference docs, API docs) from the same site output. https://pulsar.apache.org/contribute/site-intro/

Effects:

- **Build time and memory:** live build stays at Latest plus a small window. Each frozen version is built once (one Docusaurus build per version or per batch of versions, sized to fit memory) and its output stored; later deploys copy it. **[inference]** Unlike the projects above, this site can serve archives under the same domain and URL scheme (`/identity/7.2.0/…`) by merging the stored output into the deploy, instead of using another domain.
- **Shared navigation:** an archived snapshot carries the header and theme of the day it was built; site-wide changes (new products in the catalogue, theme fixes) do not reach it unless it is rebuilt. **[inference]** Rebuild snapshots when the theme changes (a scheduled or manual job), not on every content bump.
- **Version selector:** archived versions appear as plain `href` entries (Docusaurus pattern above). Within the same domain, use `pathname://` or absolute URLs so the SPA router does a full page load: "We provide a `pathname://` protocol that allows you to redirect to another part of your domain in a non-SPA fashion." https://docusaurus.io/docs/advanced/routing . The selector stays per page only for live versions; archived entries can only point to a version home unless a page map is shipped **[inference]**.
- **Search:** DocSearch crawls the whole domain, so snapshots can be indexed, but contextual search only filters by the `docusaurus_tag` of live instances; scoping to archived versions needs custom `facetFilters`, and `externalUrlRegex` handles results that live outside the SPA. https://docusaurus.io/docs/search . **[inference]** Snapshots built by Docusaurus emit the same meta tags, so a single index still works.
- **Broken links:** the live build cannot see archived routes. Links into them must bypass the checker (`pathname://`, absolute URLs) **[inference: protocol links are treated as external]**, and each snapshot is checked once when built.
- **Fit with the map:** the same "serve static output beside the live site" path covers versions with no source (HTML archives of current sites).

## 5. Option C: split into several Docusaurus sites

- Maintainer-recommended for very large content (#3132, #10895). Each site builds and deploys independently, so memory per build is bounded.
- **Navigation:** shared header must be a shared theme package or swizzled components in every site; cross-site links are external links (full page loads).
- **Search:** one DocSearch application and one index can cover all sites under one domain; DocSearch allows one application per project (see [search research](../../wso2-docs-site/research/03-search-options.md)). `externalUrlRegex` handles cross-site results. https://docusaurus.io/docs/search
- **Version selector:** native within each site.
- **Broken links:** only within a site; cross-site links are unchecked unless a post-build link checker runs over the merged output **[inference]**.
- **[inference]** Splitting by product is close to what the quick build already does (`DOCS_SECTIONS`); splitting by version is the same as Option B.

## 6. Option D: partial or incremental builds

- Docusaurus has no page-level incremental SSG; content loading, SSG and link checking rerun every time; only the Rspack persistent cache speeds up bundling. https://github.com/camunda/camunda-docs/issues/10207 , https://docusaurus.io/blog/releases/3.8
- Partial builds exist only as config scoping: `onlyIncludeVersions`, building only some plugin instances (this site's `DOCS_SECTIONS`, Camunda's `DOCS_BUILD_VERSIONS`), or `docusaurus build --locale`. Each yields a partial site, not an update to a full one. **[inference]** Merging partial outputs is Option B or C under another name, with the same sitemap, search and link-check gaps.

## 7. Comparison

| | A: one build | B: frozen snapshots | C: several sites | D: partial builds |
|---|---|---|---|---|
| Build time per deploy | grows with every version | Latest window only | per site | only for dev/preview |
| Memory | likely beyond 16 GB | bounded by window and snapshot batch | per site | per slice |
| Shared navigation | native | frozen at snapshot time | shared package needed | n/a |
| Version selector | native, long | live native, archived as plain links | native per site | n/a |
| Search | native contextual | one index, custom facets for archives | one index, external URL handling | n/a |
| Broken links | full, slow | live only; snapshots checked once | per site | warnings for omitted parts |

## 8. Open points for issue 07 (build architecture)

- Re-test Docusaurus Faster (`faster: true` plus `v4.removeLegacyPostBuildHeadAttribute`) on current content and on two versions of one section; record time and peak RSS.
- Measure one frozen version build (for example one older API Manager release) to size snapshot batches.
- Decide the live window (Latest only, or Latest plus N) and whether the version selector shows archived entries per page or per version home.
- Decide how snapshots pick up theme changes and when they are rebuilt.
