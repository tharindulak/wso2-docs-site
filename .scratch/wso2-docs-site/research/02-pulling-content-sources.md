# 02 Pulling content sources into one Docusaurus build (researched 2026-10-06)

Question: [issues/02-pulling-content-sources.md](../issues/02-pulling-content-sources.md). Background: [00-initial-facts.md](00-initial-facts.md).

Sources: GitHub API via `gh`, Docusaurus source and docs, GitHub/git/npm/Antora docs. Claims marked **[inference]** are my reasoning, not stated by a source. **[unverified]** means not checked against a primary source in this pass.

## TL;DR

- Docusaurus can only read versioned docs from `<siteDir>/<pluginId>_versioned_docs/version-X/` plus `<pluginId>_versions.json`. The paths are hard-coded (`getVersionDocsDirPath` in [versions/files.ts](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-plugin-content-docs/src/versions/files.ts)). Requests to make them configurable are open ([#8061](https://github.com/facebook/docusaurus/issues/8061), [#11288](https://github.com/facebook/docusaurus/issues/11288)). So **whatever pulls the content, a staging step must lay it out as real files in that shape.** Symlinks are only supported for the root docs folder ([#10751](https://github.com/facebook/docusaurus/issues/10751), [#11080](https://github.com/facebook/docusaurus/issues/11080)).
- The Docusaurus maintainers' stated answer for branch-per-version content is "copy the docs over as part of your build process" or one site per branch ([#10751 comment](https://github.com/facebook/docusaurus/issues/10751), [#8373](https://github.com/facebook/docusaurus/issues/8373)).
- The closest live prior art, **Apache APISIX website**, does exactly that with a fetch script: sparse clone, iterate `release/*` branches, copy into `docs-<project>_versioned_docs`, daily cron rebuild.
- Recommended shape **[inference]**: a build-time fetch script driven by a committed **lock manifest of commit SHAs** (not branch names). Bump PRs update the manifest, and the deploy builds only from the manifest. That gives submodule-style pinning and review without submodule ergonomics, and handles both the folder-per-version (docs-is) and branch-per-version (docs-apim, docs-mi) layouts with one code path.

## 1. What the content sources look like today (verified with `gh`, 2026-10-06)

| Repo | Default branch | Version layout | Tags/releases | Size of default-branch tree | Build/publish today |
|---|---|---|---|---|---|
| wso2/docs-is | master | Folders on master: `en/identity-server/{5.9.0 … 7.3.0, next}`, plus `en/asgardeo/` (unversioned), shared `en/includes/` (726 .md) | Yes: auto-tags `v0.0.N` and `v0.0.N-prod` per push, with Asgardeo build zips as release assets (`release-docs.yml`) | 31,678 files, about 4.8 GB checked out (1.3 GB unique blobs). Each IS version folder is 250 to 640 MB, mostly images. `asgardeo/docs` is 570 MB. 7.3.0 alone has 852 .md | MkDocs; `release-docs.yml` uses `secrets.IAM_DOCS_GITHUB_BOT_TOKEN` |
| wso2/docs-apim | master | Branch per version: 3.0.0 … 4.7.0 (plus ad hoc `4.6.0-backup`, `4.6.0-revamp`, `4.5.0-new`) | **None** | master: 4,172 files, 618 MB, 602 .md | MkDocs, no deploy workflow in repo |
| wso2/docs-mi | main | Branch per version: 4.2.0 … 4.6.0 (plus `4.4.0-backup`); main = 4.7.0 | **None** | main: 8,481 files, 1.44 GB, 978 .md | MkDocs; `weekly_sync_4.5.0_to_main.yaml` cron-merges 4.5.0 into main via a PR |
| wso2/docs-devant | main | Unversioned | None | (repo 218 MB) | `publish_docs.yaml`: `mkdocs gh-deploy` on push to main |

Commands: `gh api repos/wso2/<repo>/branches`, `gh api repos/wso2/<repo>/git/trees/<branch>?recursive=1`, `gh api repos/wso2/<repo>/tags`. Sizes are summed blob sizes from the tree API.

Implications **[inference]**:
- docs-apim and docs-mi have no tags, so the only stable pin is a **commit SHA**.
- Branch names are not a clean version list (`-backup`, `-revamp`, `-new`). An explicit allow-list of branch → version is needed, not a pattern.
- In docs-is, `en/includes/` lives outside the version folders on master. Editing an include changes **every** version at once, so "folder per version" does not freeze content the way branches do. The pull step must copy (or resolve) includes for each version it stages.
- The size is mostly images duplicated per version. Any approach must use **sparse and shallow checkout** (only the version folders actually published), or CI clone time and disk use dominate. `actions/checkout` supports `sparse-checkout`, `filter` and `fetch-depth` ([README](https://github.com/actions/checkout)).
- All four repos are public (Apache-2.0), so **reading** them needs no token.

## 2. Docusaurus constraints that every approach must satisfy

- **Fixed layout.** The current version comes from the plugin's `path` (relative to site dir). Other versions come from `<siteDir>/<id>_versioned_docs/version-<name>/` and `<id>_versioned_sidebars/version-<name>-sidebars.json`, listed in `<id>_versions.json` ([source](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-plugin-content-docs/src/versions/files.ts), [multi-instance docs](https://docusaurus.io/docs/docs-multi-instance), [versioning docs](https://docusaurus.io/docs/versioning)).
- **Content outside the site dir is discouraged.** A maintainer warns it can resolve React from a different `node_modules` and cause duplicate React at runtime, because "your content files ARE real components after being compiled" ([#8061 comment](https://github.com/facebook/docusaurus/issues/8061)).
- **Symlinks.**
  - Only a symlinked root docs folder works, and only with webpack `resolve.symlinks = false`, which does not work with pnpm ([#10751](https://github.com/facebook/docusaurus/issues/10751), [#3272](https://github.com/facebook/docusaurus/issues/3272)).
  - A user who symlinked versioned docs from git worktrees hit a render error, because the files were treated as partials outside a content dir ([#11288](https://github.com/facebook/docusaurus/issues/11288)).
  - Treat symlinks as unsupported for production builds **[inference]**.
- **Branch-based versioning is out of scope for Docusaurus.** The maintainer suggests either one site per branch merged at hosting level, or copying ([#8373](https://github.com/facebook/docusaurus/issues/8373)).
- **Large instances.** The docs say: "If each documentation instance is very large, you should rather create 2 distinct Docusaurus sites" ([multi-instance](https://docusaurus.io/docs/docs-multi-instance)). There is no incremental build, so any content-source change rebuilds every product **[inference from the same page's rationale]**.
- **Version count.** "Try to keep the number of your versions below 10", and limit to 2 or 3 versions in dev and previews with `onlyIncludeVersions` ([versioning](https://docusaurus.io/docs/versioning)). docs-is alone has 11 IS versions, including `next`.
- **Last-updated metadata.**
  - `showLastUpdateTime/Author` read git history ([plugin options](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs)). Copied files lose that history.
  - Docusaurus's VCS code explicitly discovers **submodules** (`getGitSubmodulePaths` in [gitUtils.ts](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-utils/src/vcs/gitUtils.ts)). The 3.10 release notes warn of "edge cases with multiple nested Git repositories or submodules" for the new `git-eager` strategy ([3.10 blog](https://github.com/facebook/docusaurus/blob/main/website/blog/releases/3.10/index.mdx)).
  - With a copy-based approach, the fetch script would have to carry dates over in front matter (`last_update`) **[inference]**.
- **Edit links.** `editUrl` accepts a function receiving `versionDocsDirPath` and `docPath` ([plugin options](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs)). That is enough to map a staged file back to its source repo, branch and path, provided the fetch step records a path map **[inference]**.
- **Format.** The sources are MkDocs Markdown today (00-initial-facts §2e). Unless the source repos migrate to MDX first, a **transform step** (MkDocs to MDX: admonitions, tabs, includes, variables) sits in the pull pipeline, whichever pull mechanism is chosen **[inference]**.

## 3. Options compared

### A. Git submodules in the docs-site repo

How it works:
- The superproject records a gitlink, "the object name of the commit that the superproject expects the submodule's working directory to be at" ([gitsubmodules](https://git-scm.com/docs/gitsubmodules)).
- docs-is needs one submodule, which brings all version folders. docs-apim and docs-mi need **one submodule entry per version branch**, because one path pins one commit **[inference from gitlink model]**.
- A staging script still has to copy each version into `<id>_versioned_docs/version-X` (section 2).

Assessment:
- **Pinning and review:** strong. Every content change reaching the site is a reviewed SHA bump in the docs-site repo.
- **Rebuild trigger:**
  - Dependabot supports the `gitsubmodule` ecosystem ([supported ecosystems](https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories)), so bump PRs can be automated on a schedule with no token in the content repos.
  - Faster propagation needs a `repository_dispatch` from each content repo (see section 4).
- **Local preview for writers:**
  - Poor. Writers must clone the site with `--recurse-submodules`, then point a submodule at their local working branch or edit inside the submodule.
  - The staging copy breaks hot reload unless a file watcher re-copies **[inference]**.
  - Shallow and sparse submodules are possible but awkward. A full docs-is submodule is about 4.8 GB checked out (section 1).
- **Build time:** same Docusaurus cost as the other options. Clone cost is high unless configured `shallow` and sparse.
- **Mapping:** the IS folders map to `is_versioned_docs/version-X` by copy. Each APIM/MI branch submodule maps to one version.
- **Pros:** native last-update support via submodule discovery.
- **Security:**
  - Pinned SHAs (good).
  - Submodules have a history of clone-time RCE bugs, e.g. CVE-2024-32002, "Recursive clones on case-insensitive filesystems that support symlinks are susceptible to Remote Code Execution" ([GHSA-8h77-4q3w-gfgv](https://github.com/git/git/security/advisories/GHSA-8h77-4q3w-gfgv)). This affects macOS writers doing `--recursive` clones. Keep git patched.
  - Private content sources would need a token passed to `actions/checkout` `submodules:` ([checkout README](https://github.com/actions/checkout)).
- **Prior art:** the IOTA Wiki (Docusaurus) pinned external repos as submodules under `docs/external/*`, with `yarn checkout` (pinned) vs `yarn checkout:remote` (latest), and `SELECTED_SECTION=… yarn start` to preview a subset ([iotaledger/iota-wiki package.json](https://github.com/iotaledger/iota-wiki/blob/main/package.json), [.gitmodules](https://github.com/iotaledger/iota-wiki/blob/main/.gitmodules)). The repo is **archived** (last push 2025-02), so the pattern is proven but not current.

### B. Build-time fetch script (clone or sparse-checkout, then copy into Docusaurus layout)

How it works:
- A script reads a manifest (product → repo → version → branch or folder → SHA), sparse-clones only the needed paths, runs the MkDocs-to-MDX transform, and writes `<id>_versioned_docs`, sidebars and `<id>_versions.json`.
- The same code path covers both layouts. A docs-is version is a folder at a SHA on master. An APIM version is a branch at a SHA. Antora models the two layouts the same way, with `branches` vs `start_paths` ([Antora branches](https://docs.antora.org/antora/latest/playbook/content-branches/), [start_paths](https://docs.antora.org/antora/latest/playbook/content-source-start-paths/)), which is a good design reference **[inference]**.

Assessment:
- **Pinning:** depends on the manifest.
  - **Unpinned** (clone branch HEAD at build) means any push to a content repo goes live on the next build with no docs-site review, and builds are not reproducible.
  - **Pinned** (SHA lock file plus bot bump PRs) gives submodule-grade control **[inference]**.
- **Rebuild trigger:** cron (APISIX rebuilds daily), `repository_dispatch` from content repos, or manual `workflow_dispatch`.
- **Local preview:** best of the three.
  - The script can accept `--local is=../docs-is`, copy or watch a local working tree, and limit to one product and version (`onlyIncludeVersions`) **[inference]**.
  - Writers stay in their own repo and run one command in the site repo.
- **Build time:** the clone cost is controllable through sparse, shallow or blobless clone of only the published folders. APISIX uses `--sparse` plus `--filter=blob:none` locally, and only `--sparse` in CI.
- **Mapping:** a direct write into the required layout. Edit URLs and last-update dates must be carried by the script.
- **Security:**
  - Fetched content is **code**: MDX compiles to React and can `import`/`export` and run JSX at build time and in readers' browsers ([#8061 comment](https://github.com/facebook/docusaurus/issues/8061)). Pulling unpinned MDX means a compromised writer account in any content repo can inject script into the whole site.
  - Mitigations **[inference]**:
    - pin SHAs;
    - lint for disallowed `import`s and raw HTML or `<script>`, using an allow-list of components;
    - run the transform in a job without deploy secrets;
    - set `persist-credentials: false` on checkouts;
    - pin third-party Actions by SHA.
- **Prior art (live):** [apache/apisix-website `scripts/sync-docs.js`](https://github.com/apache/apisix-website/blob/master/scripts/sync-docs.js).
  - Sparse-clones each product repo (`sparse-checkout set docs`).
  - Iterates `remotes/origin/release/*` branches.
  - Copies into `docs-<project>_versioned_docs/version-X`.
  - Converts each repo's own `config.json` sidebar into Docusaurus versioned sidebars.
  - Rewrites image links to `raw.githubusercontent.com/apache/<project>/<branch>/docs/...`.
  - Rebuilds on push, PR and a daily cron ([deploy.yml](https://github.com/apache/apisix-website/blob/master/.github/workflows/deploy.yml)).
  - Product versions are listed in [`config/docs.js`](https://github.com/apache/apisix-website/blob/master/config/docs.js).
  - Two cautions: it tracks branches (unpinned), and hot-linking images to a branch on raw.githubusercontent.com means images can change or vanish after the build. Do not copy that part.
  - The repo also has a `next/` tree with its own `sync-content.mjs`, which may signal a framework migration **[unverified]**.
- **Prior art (archived):** [cosmos/cosmos-sdk-docs `sync_script.sh`](https://github.com/cosmos/cosmos-sdk-docs/blob/main/sync_script.sh) clones cosmos-sdk, loops over `versions.json`, and checks out `release/vX.x` per version into `versioned_docs`. It notes a special case because Docusaurus trims the trailing zero from "0.50". The repo is archived.
- **Off-the-shelf plugin:** [docusaurus-plugin-remote-content](https://github.com/rdilweb/docusaurus-plugin-remote-content) (MIT, v4.0.0, 2023-11, peer `@docusaurus/core` 2.x or 3.x) downloads an explicit list of **individual files** over HTTP, with a separate instance for images. It does not fit thousands of files across versions, and it is not maintained at pace **[inference from release date]**.

### C. Publish content as packages (npm, or Go/Hugo-style modules)

How it works:
- Each content repo's CI publishes a versioned package (e.g. `@wso2/docs-apim-content@4.7.0+<sha>`).
- The site declares them in `package.json`. The lockfile pins exact tarballs and integrity hashes, and a postinstall or prebuild step copies `node_modules/...` into the Docusaurus layout.

Assessment:
- **Pinning:** strong (lockfile and integrity hashes). Renovate or Dependabot bump PRs act as the trigger.
- **Rebuild trigger:** package publish, then a bump PR, then the site build. This adds latency and requires every content repo to own release CI.
- **Local preview:** `npm link` or a `file:` dependency is possible but clunky. The stronger variant inverts it: publish the **site's theme, preset and transform as a package**, and let each content repo preview itself with `npx <cli> start`. IOTA did this with `@iota-wiki/cli` (`start` runs `docusaurus start --config <internal config> <dir>`; [cli/src/commands/start.tsx](https://github.com/iotaledger/iota-wiki/blob/main/cli/src/commands/start.tsx)).
- **Build time:** no git cost, but the tarballs are big. An APIM branch is about 600 MB and MI about 1.4 GB, mostly images. The npm registry is a poor fit for 0.5 to 1.5 GB artifacts per version **[inference; no npm size limit verified]**. Images would need to go to a CDN or object store, which adds a second pipeline.
- **Mapping:** one package per product and version maps to one `version-X` folder.
- **Security:**
  - Publishing tokens in every content repo are a supply-chain risk. Prefer npm **trusted publishing** (OIDC, no long-lived token), which auto-generates provenance for public repos on GitHub Actions ([npm docs](https://docs.npmjs.com/trusted-publishers)).
  - Run `npm ci --ignore-scripts` for content packages, since install scripts are code **[inference]**.
- **Prior art:**
  - **Docker docs** (Hugo) vendors content from other repos as Go modules. `go.mod` pins versions, for example `github.com/docker/buildx v0.37.2` and `github.com/moby/buildkit v0.33.1`. `go.sum` holds checksums, `hugo.yaml` `module.imports[].mounts` maps a source subpath to a site path, and content is vendored into `_vendor/` with `make vendor` ([docker/docs go.mod](https://github.com/docker/docs/blob/main/go.mod), [hugo.yaml](https://github.com/docker/docs/blob/main/hugo.yaml)). Docusaurus has no equivalent mount system, so the copy step stays **[inference]**.
  - **Antora** (Couchbase, Spring and others) treats multi-repo, multi-branch content as first-class through playbook content sources, but that is a different SSG.

### D. (Alternative noted by maintainers) One Docusaurus build per content source, stitched at hosting

- Each product or version builds its own site with its own `baseUrl`, and the outputs are merged under one domain ([#8373](https://github.com/facebook/docusaurus/issues/8373); suggested for large instances in [multi-instance](https://docusaurus.io/docs/docs-multi-instance)).
- Pros: independent rebuilds, short build times, and content repos keep their branch model unchanged.
- Cons for "one navigation, one search" (CONTEXT.md *Docs site*): the navbar, version dropdowns and theme must come from a shared package. Search must be an external index such as Algolia or Typesense across sites, since local-search plugins index one build **[inference]**.

## 4. Comparison

| | A. Submodules | B. Fetch script + SHA lock | C. Packages | D. Per-source builds |
|---|---|---|---|---|
| Pinning and review | SHA in gitlink | SHA in manifest (only if locked) | Lockfile and integrity hash | Per repo |
| Rebuild trigger | Dependabot `gitsubmodule` PR, or dispatch | Bot bump PR, cron or dispatch | Publish, then bump PR | Push in content repo |
| Writer local preview | Poor | Good (local override flag) | Fair, or good if the site ships a preview CLI | Good (native) |
| Clone/download cost | High unless shallow and sparse | Low (sparse, filtered) | Large tarballs | Per repo |
| Docusaurus build time | Whole site | Whole site, but subsettable | Whole site | Per product |
| Handles folder and branch layouts | Yes, with N submodules | Yes, one code path | Yes, needs CI in every repo | Yes |
| Last-update metadata | Native (submodule-aware) | Script must carry it | Script must carry it | Native |
| Live Docusaurus prior art | IOTA (archived) | APISIX (live), Cosmos (archived) | None found for Docusaurus; Docker (Hugo) | Docusaurus own site (hybrid archive) |

## 5. Rebuild triggers and CI tokens (security)

- **`repository_dispatch`:**
  - Content repo CI calls `POST /repos/{owner}/{site}/dispatches`. It triggers only workflows on the target's default branch, and `client_payload` is limited to 10 top-level keys and 65,535 characters ([events doc](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).
  - It needs **Contents: write** on the docs-site repo for fine-grained PATs ([permissions table](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)), or the classic `repo` scope ([REST](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event)).
  - **Risk:** a token that can dispatch can also push to the docs-site repo. Storing it in every content repo widens the blast radius. Prefer a GitHub App installed only on the docs-site repo, minting short-lived installation tokens, or avoid cross-repo tokens altogether **[inference]**.
- **Pull-based alternatives (no token in content repos):** a cron job in the site repo runs `git ls-remote` against the public content repos and opens a bump PR when SHAs change. Dependabot does the same for submodules.
- **Existing WSO2 token use:** docs-is release CI already uses a bot PAT (`IAM_DOCS_GITHUB_BOT_TOKEN`) with `fetch-depth: 0`. Reuse it carefully, or not at all. Its scope is unknown **[unverified]**.
- **General hygiene:**
  - Never expose deploy secrets to `pull_request` builds of content from forks.
  - Set `persist-credentials: false` on checkouts (the token is otherwise kept in git config; [checkout README](https://github.com/actions/checkout)).
  - Pin Actions by SHA.
  - Treat fetched MDX as untrusted code until it has been reviewed or pinned.

## 6. Open points for the decision

1. Should content go live on merge to a content repo (unpinned, fast) or after a docs-site bump PR (pinned, reviewed)? This is the main trade-off, and it drives the choice of trigger.
2. Will source repos migrate to MDX in place, or will the pull pipeline transform MkDocs Markdown on every build? The answer decides where the transform and the lint gate live.
3. Where should images go? Copying 250 to 640 MB per IS version and about 0.6 to 1.4 GB per APIM/MI branch into each build is the dominant cost. One option is dedup into a CDN or object store keyed by hash **[inference]**.
4. docs-is `en/includes/` is shared across versions on master. Should a staged old version snapshot its includes at a SHA, or deliberately track master?
5. Version count: docs-is has 11 IS versions, against the Docusaurus advice to stay below 10. Older versions may be better served as archived static builds (option D, for old versions only).
