# Rollout to all products: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** every published self-hosted version with source, for every remaining section, is served from the docs site, the way the pilot serves Identity Platform and Micro Integrator.

**Architecture:** no new pipeline. Each section gets a `versions:` list (and `older_versions` Confluence links) in `docs-site/content-sources.yaml`; older versions become snapshots (`npm run snapshots -- build <id> --record-baseline`), assembled with the live build. API Platform is split from one section into per-component sections first.

**Spec:** [Rollout order and cut line](../issues/13-rollout-order-and-cut-line.md) (decisions), [Version inventory](../research/02-version-inventory.md) (refs, shas, page counts), [Build the pilot](../issues/10-build-the-pilot.md) (the pipeline), `docs-site/README.md` "Versions" and `docs-site/CONTENT-RELEASES.md` (commands and schema).

## Global Constraints

- Branch `docs-site-versions`. Never push, create releases, forks or PRs. No new npm dependencies. No shell interpolation (`execFileSync` with argument arrays).
- Refs come from `wso2/<docs repo>` only. Never the `apim-*` or component branches of `wso2/docs-api-platform` (they install `docs-shared-hooks` from a personal fork). Resolve each ref's sha with `git ls-remote` at build time and pin it; record the sha in the lock.
- `live_window` stays `1` unless Task 5 measures a Faster build of window 2 under 60 min and 14 GB. The live build needs `DOCS_HEAP_MB=12288`.
- The only new dependency allowed is `@docusaurus/faster` (user approval 2026-10-11), pinned to the installed Docusaurus version (3.10.2).
- Baselines: `--record-baseline` only for a version's first build. New broken links caused by converter changes are bugs, not baseline entries.
- The machine has 16 GB RAM shared with Chrome and about 68 GB free disk. One heavy build at a time; kill any server you start.
- Stage only files you changed; `prototypes/`, `docs-site/architecture/`, `.scratch/`, `.superpowers/` are not committed. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A version's `exclude` list hides real content: excluded pages must be ones that fail to convert, and each is reported with the reason.
2. An older version's pages link into Latest pages that do not exist (the IS 6.x pattern): counted in the baseline report per version.
3. The API Platform split breaks existing URLs: every old `/api-platform/platform/<component>/...` URL must redirect to the new section.
4. A big snapshot runs out of memory and leaves a partial tarball or a lock entry pointing at nothing.
5. Version strings outside the three-number pattern (`2026.09.24`) are rejected or mis-sorted.

---

### Task 0: Sign-off hardening before any snapshot build

From [Finish the pilot sign-off](../issues/15-finish-pilot-sign-off.md):

- [ ] Snapshot key covers `site/account/`, `site/account-sidebars.js` and `site/static/` (they feed snapshot builds); test that changing a file there changes the key.
- [ ] `.github/workflows/docs-site-snapshots.yml`: the token-free build and the upload that holds the write token run in separate jobs; the build job hands the tarball over as a workflow artifact; the upload job runs no repo scripts that the build job could have modified and no `npm ci`. Keep `SNAPSHOT_ID` validation.
- [ ] Tests green; commit.

### Task 1: Small sections

Streaming Integrator (`integration-si`): Latest stays `main` (4.4.0); add 4.3.1 and 4.3.0 (branches). Kubernetes Gateway (`kubernetes-gateway`): Latest moves to branch `1.3.0` with `version: 1.3.0`; add 1.2.0, 1.1.0, 1.0.0 (branches); 2.0.0 stays out. Financial Services (`financial-services`): Latest stays `master` (4.0.0); add 3.0.0 (branch) and `older_versions` 2.0.0, 1.5.0, 1.4.0, 1.3.0 (Confluence `spaces/OB*`; find the space keys from the live versions selector or the `versions` branch).

Micro Integrator (`integration-mi`, decided 2026-10-11, [Confirm live refs](../issues/09-confirm-live-refs.md) Q4 and Q8): Latest 4.6.0 moves from `main` (labelled 4.7.0, unreleased) to branch `4.6.0`, keeping `track` on that branch; add `older_versions` links for Enterprise Integrator 7.1.0 and 7.0.0 (`https://ei.docs.wso2.com/en/7.1.0/` and `/en/7.0.0/`; check both URLs respond; label them so readers see they are EI docs, extending the older_versions entry with an optional `label` if the schema needs it).

- [ ] Lock entries (`release_tag`, `former_site`, `current_site` per the schema), validator passes.
- [ ] Content run for the new versions; fill each `exclude` list from conversion failures.
- [ ] `snapshots build <id> --record-baseline` for each of the 6 new versions.
- [ ] Tests green; commit per section.

### Task 2: Split API Platform into per-component sections

Today `api-platform-platform` holds API Gateway, AI Gateway, API Portal and AI Workspace, with `nav_pick` choosing one version folder each and `skip` hiding the rest. Split them into sections under the API Platform product: routes `api-platform/api-gateway`, `api-platform/ai-gateway`, `api-platform/api-portal`, `api-platform/ai-workspace`, source = version folders on `wso2/docs-api-platform` main (folder source kind, as Identity uses). Versions: API Gateway 1.2.0 (Latest), 1.1.0, 1.0.0; AI Gateway 2026.09.24 (Latest), 1.2.0, 1.1.0, 1.0.0; API Portal 1.0.0; AI Workspace 1.0.0. `release_tag` `<component>/v` (API Gateway `gateway/v`, AI Gateway `ai-gateway/v`, API Portal `api-portal/v`, AI Workspace `portals/ai-workspace/v`, per the inventory).

- [ ] Remove the components from the platform section (nav_pick, skip, deployment_overrides) and add the four sections; keep the platform section's remaining content.
- [ ] Old URLs `/api-platform/platform/<component>/...` redirect to the new section (use the existing redirect mechanism; check `site/build` output).
- [ ] Version `2026.09.24` validates and sorts above `1.2.0`; add a test. If the validator needs a change, keep it minimal.
- [ ] Shared snippets and assets the component folders reference from outside their folder still resolve.
- [ ] Snapshots with `--record-baseline` for the 5 older component versions. Tests green; commit.

### Task 3: API Manager

`api-platform-apim` (merged section with `cloud_companion`): Latest 4.7.0 moves from `master` to branch `4.7.0` (decided 2026-10-11, Confirm live refs Q5), keeping `track` on that branch. Add 4.6.0 down to 3.0.0 (branches on `wso2/docs-apim`) and `older_versions` for 2.6.0, 2.5.0, 2.2.0, 2.1.0, 2.0.0, 1.10.0, 1.9.1, 1.9.0 (Confluence `spaces/AM*`). The current `older_versions` string (a link to 4.6.0's former site) is replaced by the list.

- [ ] Lock entries; validator passes.
- [ ] Snapshots smallest first; 4.2.0, 4.1.0, 4.0.0 last with the 12 GB heap. A version that runs out of memory twice is moved to `older_versions` as a link to its former site (`https://apim.docs.wso2.com/en/<v>/`), with the measured peak and page count reported.
- [ ] Tests green; commit.

### Task 4: Live build, assemble, gate, measure

- [ ] Delete `site/build-merged` and `site/build`. Live build (`DOCS_HEAP_MB=12288`), time and peak memory.
- [ ] Assemble all snapshots into `site/build-merged`; `check-links site/build-merged --baselines link-baselines` exits 0 (re-record `live.json` only for breakage that is source content, with counts).
- [ ] Record per-version page counts, snapshot build time, peak memory, tarball size, total disk in `research/16-rollout-measurements.md`.

### Task 5: Docusaurus Faster

- [ ] Add `@docusaurus/faster` at the installed Docusaurus version (3.10.2) to the site package; `npm ci` lockfile updated; note its own dependency tree size (`npm ls @docusaurus/faster --all | wc -l`) in the measurements file as a supply-chain note.
- [ ] Measure the live build with Faster (`future: { v4: true }` or the faster flags) at `live_window: 2`, heap 12 GB: wall time, peak memory, success. The config comment says Faster broke on near-identical versioned MDX in docs-agent-platform: re-test that section.
- [ ] If window 2 with Faster is under 60 min and 14 GB, set `live_window: 2` (the previous release of each versioned section moves from snapshot to live) and re-run the merged gate; otherwise keep window 1 and decide whether Faster stays on for window 1 by its own numbers (keep it only if it is faster and the output passes the same gate).
- [ ] Record the numbers; tests green; commit.
