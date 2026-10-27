# Reusable bundle workflow spec

Parent: [map](../map.md)
Type: grilling (HITL)
Status: closed
Assignee: tharindulak
Blocked by: 02, 03, 04, 11

## Question

Specify the reusable workflow content repos call to publish a bundle: trigger, inputs, the `wso2-docs check` step, packing to the agreed layout, manifest and checksum, provenance attestation, release creation with the repo's own token, permissions, where the workflow is pinned from, and how teams adopt it (the lines they add).

Inputs from [Release facts on the forks](11-release-facts-on-the-forks.md): the workflow-file mismatch rejection was not reproduced (decide whether to keep the identical-files check); no tag ruleset on the forks (Actions cannot bypass on user-owned repos); draft, attach, publish yields immutable releases.

Inputs from [Rehearse a bundle release on the API Platform fork](12-rehearse-a-bundle-release-on-the-api-platform-fork.md): the [prototype workflow](../assets/12-rehearsal/docs-bundle.yml) and [pack script](../assets/12-rehearsal/pack.mjs) are a starting point; pack with docs-site code only; leave out `.wso2-docs-tree`; decide on tree-wide `redirects.json`.

## Progress

Decided with the user, 2026-10-27:
- Q56: the same reusable workflow runs on `pull_request` to `release/**` in check-only mode (read-only, no pack or publish) as the required status check; replaces `check-action` for release branches.
- Q57: the manifest's `docs:` names the version's pages folder (`versioned_docs/version-1.1.0` for older versions); the bundle's `redirects.json` holds only its own version's map.
- Q58: deterministic zip (sorted entries, fixed timestamps, no extra attributes); limits 200 MB and 20,000 files, set on the docs-site side.
- Q59: release title `<section label> <version>`, generated notes (section, version, source commit, sha256, check summary, run link), `--latest=false`, never a prerelease.
- Q60: no identical-workflow-file check.
- Caller location: the caller must be a file in `.github/workflows/` (GitHub reads triggers nowhere else); it cannot live in `wso2-docs.yaml`, which is data writers edit. A docs-site owner adds it once at onboarding; release branches inherit it. Rejected: no caller with intake packing on the docs-site side (loses team-published releases and the PR check, needs App access to every content repo).

## Resolution

Decided with the user, 2026-10-27 (Q53 to Q64; Q56 to Q60 and the caller location above). Builds on [Content-repo release flow](04-content-repo-release-flow.md), [Docs bundle layout and manifest](03-docs-bundle-layout-and-manifest.md), [Release facts on the forks](11-release-facts-on-the-forks.md) and the [rehearsal](12-rehearse-a-bundle-release-on-the-api-platform-fork.md) ([prototype workflow](../assets/12-rehearsal/docs-bundle.yml)).

**Where it lives.** `.github/workflows/docs-bundle.yml` in the docs-site repo, `on: workflow_call`. Callers use `<docs-site repo>/.github/workflows/docs-bundle.yml@v1`; `v1` is a moving tag that docs-site owners move. The converter commit it checks out is a literal in the file, so moving `v1` moves workflow and converter together. Intake requires the attestation signer to be exactly that file at `refs/tags/v1`. `v2` only for a breaking caller change. Actions inside pinned by commit SHA; gh >= 2.102.0.

**Caller** (one per content repo, added once by a docs-site owner at onboarding; release branches inherit it; no inputs):
```yaml
name: docs bundle
on:
  push: { branches: ['release/**'] }
  pull_request: { branches: ['release/**'] }
permissions: {}
jobs:
  bundle:
    uses: tharindulak/wso2-docs-site/.github/workflows/docs-bundle.yml@v1
    permissions: { contents: write, id-token: write, attestations: write }
```
On `pull_request` the workflow runs check-only (read-only); on `push` it checks, packs, attests and publishes.

**Section selection.** Each `wso2-docs.yaml` declares its `release_tag` prefix (`gateway/v`, or `v` in a single-distribution repo); exactly one manifest in the repo must match the branch's component (`release/<component>/<x.y.z>` or `release/<x.y.z>`; `release/latest` for sections with no versions). Components are one path segment: AI Workspace's prefix becomes `ai-workspace/v` (from `portals/ai-workspace/v`; it has no releases yet). Platform releases alone from `release/latest`; the cloud tree is its own section and bundle.

**Steps** (docs-site code only; no content-repo script runs before packing):
1. Resolve section and version from the branch; find the matching manifest.
2. Check; any failure stops without publishing: manifest against the JSON Schema; branch version equals manifest version; every navigation page exists; `wso2-docs check` with no new failures (manifest `exclude`, may only shrink); no reference outside the bundle; no executable sidebar or config (exact rules in [Executable content in bundles](10-executable-content-in-bundles.md)); size and file-count limits (200 MB, 20,000 files).
3. Pack deterministically: pages from the manifest's `docs:` folder, referenced files, `include:` folders, `wso2-docs.yaml` (with source commit added), the version's own `redirects.json` map; not `.wso2-docs-tree` or sidebars.
4. Attest (build provenance).
5. Create a draft release `<prefix><version>` with the asset `<section>-<version>.docs.zip`, then publish: title `<section label> <version>`, generated notes (section, version, source commit, sha256, check summary, run link), `--latest=false`, never a prerelease. Immutable once published.

Concurrency: one run per branch. Several sections in one repo release independently (one run and one bundle per changed branch).

**Onboarding a repo** (docs-site owner): a PR to `main` adding the caller, the `manifest init` output and CODEOWNERS; then an idempotent `gh` setup script plus checklist: immutable releases on; branch ruleset on `release/**/*` (docs-site owner approval, required bundle check, only owners create or delete branches); CODEOWNERS and ruleset requiring a docs-site owner for `.github/**` and `**/wso2-docs.yaml` on `main`; product teams on write, not admin; no tag ruleset on user-owned forks (Actions cannot bypass it).
