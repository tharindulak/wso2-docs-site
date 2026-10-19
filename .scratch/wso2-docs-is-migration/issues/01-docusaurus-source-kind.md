# What the docs site's docusaurus source kind needs to carry Identity Platform

Parent: [map](../map.md)
Type: research
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

The lock file's `kind: docusaurus` copies one Docusaurus doc set as is (Agent Manager, WSO2 Integrator). What does it support today, read from `docs-site/scripts/build-content.mjs`, `packages/docs-converter/src` and `content-sources.yaml`, and what is missing for Identity Platform as a migrated `docusaurus/` tree: several versions from `versioned_docs/` (Latest live, older ones as snapshots), deployment options and labelled blocks that `mkdocs-merge` produces today (`<Applies>`, `<DeploymentValue>`, front matter defaults), `former_site`, `aliases`, `former_route` redirects, `older_versions` links, exclude lists, MDX partial imports, and static files? Output: a gap list per feature (supported / missing / needs a format decision), naming what the generated tree must carry in front matter or files versus what stays in the lock file.

## Answer

Research, 2026-10-13. Findings on branch `research/docusaurus-source-kind` (commit 82ffffd), file `.scratch/wso2-docs-is-migration/research/01-docusaurus-source-kind.md`.

- **Supported:** per-version `docs`/`sidebar` overrides read `versioned_docs/` (Latest live, older as snapshots); `former_site`, `aliases`, `former_route`, `older_versions`, exclude lists; page `deployment_options` front matter overrides the lock default; `<Applies>`/`<DeploymentValue>` pass through with their `@site` imports.
- **Missing, bugs:** static folder looked up beside the docs folder (wrong for `versioned_docs/version-X`; Agent Manager already loses repo-root `static/img`); `_` partials listed as pages in `pages.json`; CommonMark fallback silently drops partial imports; partials outside the docs folder never copied; `cloud` banner flag set only for `mkdocs-merge`; exclude fallback URL lacks trailing slash and sends Self-hosted pages to the wrong site.
- **Missing, features:** no Docusaurus layout pattern for promotion in the bump bot; `redirect_maps` not written for `docusaurus` sections (nor for merged IS Latest today: 69 Asgardeo + 298 IS 7.3.0 entries); **the HTML allow-list never runs on `docusaurus` sources** (security gap after cutover); CI accepts only `wso2/*` repos, so the fork proof runs locally.
- **Needs a format decision:** source of truth for versions (lock `versions:` or `versions.json`); shared vs per-version static (330 to 590 MB per version, copied twice today); partials location and front matter; redirects file in the tree; per-page `@site` imports vs global components; edit links to `en/` until cutover; strict compile mode; JSON-only sidebars; relative `.md` links vs absolute routes; number prefixes.
- **Tree vs lock:** the tree carries front matter, bodies, sidebars, `versions.json`, static, partials, redirects; the lock keeps repo/sha/ref, version list, excludes, routes, site URLs, `older_versions`, default `deployment_options`.
- Open for prototype: whether partials' front matter and headings leak into the importing page; number-prefix parsing effect on URLs.
