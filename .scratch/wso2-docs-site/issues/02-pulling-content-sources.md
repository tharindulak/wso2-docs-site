# Ways to pull content sources into one Docusaurus build

Parent: [map](../map.md)
Type: research
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

What are the workable ways to pull several content sources (separate GitHub repos, with versions held as folders in one branch like docs-is or as one branch per version like docs-apim and docs-mi) into a single Docusaurus build? Compare at least git submodules, build-time fetch scripts, and publishing content as packages, on rebuild triggers, local preview for writers, build time, and how each maps to Docusaurus multi-instance docs and versions. Note prior art from other large multi-repo Docusaurus sites.

## Answer

Resolved by research, 2026-10-06. Full findings: [Pulling content sources](../research/02-pulling-content-sources.md).

- Docusaurus reads versioned docs only from `<siteDir>/<id>_versioned_docs/version-X` plus `<id>_versions.json` (hard-coded; #8061, #11288 open). Symlinks fail beyond the root docs folder. Every approach needs a copy step into that layout.
- Content sources: docs-is has 11 version folders on master (checkout ~4.8 GB, mostly images duplicated per version; `en/includes` shared across versions). docs-apim and docs-mi use a branch per version with stray `-backup`/`-revamp` branches and no tags, so only a commit SHA is a stable pin. docs-devant is unversioned.
- Options compared: git submodules (pinned, reviewed, poor writer preview), build-time fetch script (most flexible, best preview, safe only when pinned), packages (poor fit for 0.6 to 1.4 GB image-heavy versions), one build per source stitched at hosting (breaks single search and navigation).
- Prior art: Apache APISIX (fetch script over release branches, daily rebuild, unpinned), IOTA Wiki (submodules, archived), Docker docs (pinned Go modules with checksums).
- Security: fetched MDX is executable code, so unpinned pulls let any content-repo push reach production unreviewed. `repository_dispatch` needs Contents: write on the docs-site repo; prefer a GitHub App or pull-based bump PRs. Keep git patched against submodule clone RCE (CVE-2024-32002).
- Researcher's recommendation (input to [How the docs site pulls content](07-content-pull-mechanism.md), not a decision): build-time fetch script driven by a committed SHA lock manifest, sparse clones, transform then copy into `<id>_versioned_docs`; bump PRs trigger rebuilds; writers preview with a local override.
