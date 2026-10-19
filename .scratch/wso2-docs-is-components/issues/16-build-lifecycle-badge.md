# Build the lifecycle badge

Parent: [map](../map.md)
Type: task
Status: closed
Assignee: tharinduj
Blocked by: 14

## Question

AFK, test-first: build the badge as decided in [How the lifecycle badge looks](14-lifecycle-badge-look.md) and [Where status is written, and what a deprecation carries](12-status-source-and-deprecation-data.md); converter changes if front matter is dropped; tests; rebuilt Identity preview checked on real pages. Record the commit and pages affected.

Spec: the answers on [How the lifecycle badge looks](14-lifecycle-badge-look.md), [Which lifecycle stages, and what each means](11-lifecycle-stages.md) and [Where status is written, and what a deprecation carries](12-status-source-and-deprecation-data.md). Route from [How status front matter reaches the site](10-status-front-matter.md): extend `KEEP_FRONT_MATTER` with value checks and report YAML errors; merge `status` per deployment option on merged pages; title pill in the `DocItem/Content` wrapper via `useDoc()`; sidebar via `sidebar_class_name` / `sidebar_custom_props` derived in `markdown.parseFrontMatter`, drawn with CSS (no `DocSidebarItem/Link` eject); strip the "(deprecated)" suffix from title, sidebar label and breadcrumb where the pill shows. `wso2-docs check` fails on bad values. Real data: the fork's seeded front matter (`274ef7ec`); regenerate the tree and bump the lock.

## Answer

Built 2026-10-14 (AFK, test-first): `docs-is-migrate` commits `7d9ead4` (badge) and `9484d49` (lock at fork `2dcedd3c`); fork commit `2dcedd3c` regenerates the tree (19 files: lifecycle front matter on the marked API pages in Latest, 7.0.0, 7.1.0, 7.2.0; "(deprecated)" removed from 3 titles and from sidebar labels).

- Converter: `src/lifecycle.ts` (exported `@wso2/docs-converter/lifecycle`) checks values, merges per deployment option, picks the badge (Preview, then Deprecated, then Beta) and strips the "(deprecated)" suffix from titles, first H1 and sidebar labels. Bad lifecycle values fail `check` and are dropped; YAML errors are warnings. `replacement`: relative `.md` (must exist), http(s) URL or site path; anything else reported and dropped.
- Merged-page shape: flat `status` / `deprecated_since` / `replacement` / `removal` when all options agree; otherwise `lifecycle: { <option>: {...} }` (an option missing from the map is generally available). Documented in the converter README.
- Site: `LifecyclePill` in the `DocItem/Content` wrapper via `useDoc()`; sidebar pill from `sidebar_class_name` / `sidebar_custom_props` set in `markdown.parseFrontMatter`, drawn with CSS; no eject.
- Tests: converter 217/217, scripts and site 113/113. Content 1,065 pages, no new failures, no front-matter warnings. Preview rebuilt; warnings identical.
- Verified: roles v1 (Deprecated), user sharing V1 (both options, no scope), user credential management (Deprecated · WSO2 Cloud); titles, sidebar and breadcrumbs without "(deprecated)"; the Redoc spec title keeps it.
- **Deviation from the chosen look (open, for the user):** the pill floats right on the title line rather than sitting right after the title text, because the H1 is rendered inside Docusaurus's content; inline placement needs an `h1` mapping in `MDXComponents` and handling for API pages whose title Docusaurus generates.
- Notes for the deprecations build: read the lifecycle fields in either shape (`checkPageLifecycle`, `lifecycleBadge`); a relative `.md` replacement still needs resolving to a site URL; section admonitions are not covered; sidebar pill text is CSS `content` (not announced by screen readers).

