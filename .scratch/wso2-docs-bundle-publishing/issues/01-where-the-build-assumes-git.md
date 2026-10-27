# Where the build assumes git sources

Parent: [map](../map.md)
Type: research (AFK)
Status: closed
Assignee: tharindulak
Blocked by: 

## Question

List every place in `docs-site/` that assumes a section's content comes from git: `fetch-sources.mjs` (sparse fetch, `sha`, `ref`, `track`), `bump-sources.mjs` and `bump-lib.mjs` (tags, branches, GA lookup), `snapshots.mjs` and `snapshot-store.mjs` (keys hashing the lock entry), `version_folder` and `docs_root`, includes and `_shared/` files read from outside a section's folder, `edit` links built from repo and branch, `migration` and `cloud_companion` entries, link baselines, the CI and workflow files. For each: what it reads from git, and what a docs bundle would have to carry (or the lock would have to record) to replace it. Note which sections share one content repo and which pages read files outside their own folder.

## Resolution

Researched 2026-10-27. Findings: [research/01-where-the-build-assumes-git.md](../research/01-where-the-build-assumes-git.md) on branch `research/01-where-the-build-assumes-git` (commit `a9e03ff`).

- 26 git assumptions (lock checks, fetch, edit links, bump and promotion, snapshot keys). Per version the lock must record source repo, release tag, asset name and bundle sha256; the bundle manifest must carry repo-relative paths, the edit branch and the source commit. The `wso2-docs convert` `manifest.json` (`cli.ts:144-150`) is a starting point.
- Shared repos: `docs-api-platform` feeds five sections plus API Manager's cloud companion at one commit; Developer Platform's two sections share `docs-choreo-dev` at different commits; Integrator+Devant and API Manager+Bijira each build one section from two repos. Most sections keep every version in one commit.
- Migrated Docusaurus trees read tree-wide files from every version (`assets/`, 1.0 GB in docs-is; `static/`, `redirects.json`, `versions.json`, converter stamp): one bundle per version either duplicates them or needs a shared-assets bundle; `checkTreeVersions` stops working.
- Risk: `.ts`/`.js` sidebars run during the build (`site.ts:733-740`), in the job that holds the R2 and VM keys; auto-merging lock PRs remove the review that limits this today. Ticketed as [Executable content in bundles](10-executable-content-in-bundles.md).
- Also: link-baseline failures need a reviewed PR and can stall auto-merge; the new version-entry shape rebuilds every snapshot once; `docs_root`, `version_folder`, `mkdocs-merge` and `_shared/` are unused by the current lock; no `migration:` key exists.
