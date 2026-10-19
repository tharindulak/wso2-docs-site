# Pilot measurements and pass criteria

Pilot of ticket 10 (build the pilot) for Identity Platform and Micro Integrator, every version. Branch `docs-site-versions`. Measured 2026-10-10 on a 16 GB macOS machine (Node 22.23, Docusaurus 3.10.2) that also ran Chrome and VS Code, so the long builds swapped heavily (system swap reached about 30 GB). Treat the build times as an upper bound for a dedicated 16 GB machine.

Outcome in one line: **the live window narrows to 1** (commit `3ab6fec`). A live build of Latest plus the previous release ran out of memory at a 12 GB heap, and the extrapolated full build exceeds both 60 minutes and 14 GB. A Latest-only live build of every product completes in 47 minutes at a 12 GB heap.

## Pass criteria

### 1. Every version at `/<route>/<version>/`, Latest without a segment: pass

| Check | Evidence |
|---|---|
| Latest has no version segment | `site/build-merged/identity/index.html` and `integration/micro-integrator/index.html` exist; `/identity/7.3.0/` and `/integration/micro-integrator/4.6.0/` do not |
| Every older version is served at its release number | `site/build-merged`: `identity/` 7.2.0 (820 pages), 7.1.0 (737), 7.0.0 (564), 6.1.0 (786), 6.0.0 (782), 5.11.0 (640), 5.10.0 (615), 5.9.0 (563); `integration/micro-integrator/` 4.5.0 (851), 4.4.0 (835), 4.3.0 (741), 4.2.0 (626) |
| A docs fix release keeps the version label | Simulated `ref: v4.4.0.1` still lists as version `4.4.0` at `integration/micro-integrator/4.4.0` (criterion 6) |

### 2. Selector across live, snapshot and Confluence versions: pass (after the final fix wave)

Checked in Chrome on `npm run preview` (`docusaurus serve` returns 404 for dotted version paths).

| Check | Result |
|---|---|
| Selector groups on a snapshot page | Latest, Previous versions (8 for Identity), Older versions (10 Confluence links with an external marker); menu scrolls at 420 px |
| Snapshot to snapshot, and snapshot to Latest | Same page kept (`/identity/7.1.0/deploy/get-started/install/` to 6.0.0 and to Latest); banner only on older versions |
| Target version lacks the page | Selector lands on the version's home from its `pages.json` (`/integration/micro-integrator/4.4.0/get-started/introduction/`) |
| Products menu from a snapshot page | Full page load to Integration Platform; the page renders (before the fix wave it rendered the snapshot bundle's 404) |
| Snapshot API reference pages | OpenAPI spec loads (before the fix wave 299 Identity 7.x pages failed) |
| Light and dark, 390 px | Both themes render; at 390 px (iframe probe) no horizontal scroll, selector and banner visible on Identity 7.1.0 and MI 4.4.0 |
| Confluence entries | Rendered with `href` to the Confluence spaces; not clicked through |

Known: visiting a version root whose index page was excluded (MI 4.4.0) redirects to the former site; the selector avoids it.

### 3. Lock file on the new schema, validator passes: pass

| Check | Evidence |
|---|---|
| Real lock file validates | `readLock()` (runs `validateVersions` per section) succeeds; `node scripts/snapshots.mjs list` prints the 12 snapshot ids |
| Validator rejects a bad lock | A copy with `track: true` on MI 4.4.0: `Error: integration-mi: only Latest (4.6.0) may track a branch; 4.4.0 is pinned` |
| Edited copies from criterion 6 validate | `DOCS_SITE_LOCK=<copy> node scripts/snapshots.mjs list` succeeds on both the fix and the new-version copies |
| Tests | `npm test`: converter 81/81, scripts and site 34/34 |

### 4. Link check on each snapshot and on the merged output: pass against baselines (after the final fix wave)

After the final fix wave the checker also resolves relative links, and the merged check gates on new links against the per-version baselines plus `link-baselines/live.json`: `check-links.mjs site/build-merged --baselines link-baselines` reports 2,785 broken links, all in baselines, 0 new, exit 0. Nine version baselines gained 149 relative links whose targets do not exist in the source. The table below is the Task 13 state, before that change.

Gate policy (Task 10 ruling): a snapshot fails only on broken links that are not in its recorded baseline (`docs-site/link-baselines/<id>.json`).

| Check | Evidence |
|---|---|
| Each snapshot | All 10 original snapshots rebuilt at their new keys with `node scripts/snapshots.mjs build <id>`: every one printed `built` and exited 0. The 2 new snapshots (Identity 7.2.0, MI 4.5.0) had their baselines recorded with `--record-baseline` (84 and 114 links, commit `1942d51`). A second pass printed `cached` for all 12 |
| Merged output | `findBrokenLinks(site/build-merged)`: 2,461 broken internal links. `node scripts/check-links.mjs site/build-merged` exits 1 |

Merged breakdown:

| Group | Links | Meaning |
|---|---|---|
| In a snapshot baseline | 1,139 | Known source breakage of the 12 snapshots |
| On live pages | 1,186 | Identical to the live build's own broken links (`site/build` has the same 1,186). Largest: API Manager 525, WSO2 Integrator 158, API Platform 134, MI Latest 110, Identity Latest 102, BI 73 |
| New on snapshot pages | 136 | Targets outside the gate's filter (`/<route>/` with the version, or `/assets/`), so no baseline holds them. All are source content: IS 6.x includes overshoot into Latest `/identity/...` pages that do not exist (107 on 6.0.0 and 6.1.0), root-relative `/develop/scim2-patch-operations/` (14, IS 5.11.0 to 7.2.0), backslash image paths `/identity/7.2.0%5Cassets%5C...` (13, IS 7.2.0), `/integration/develop/...` (6, MI 4.3.0 to 4.5.0), `6.0.0./` typos (4) |

Assembly causes no breakage: comparing `site/build` with `site/build-merged`, 0 broken links appear on live pages only after merging, and merging fixes 106 live-page links that point to snapshot versions.

### 5. Measurements recorded: partial (Faster not measured)

See Measurements below. Docusaurus Faster could not be measured: `future: { v4: true }` turns on `fasterByDefault`, and the build stops at once with `To enable Docusaurus Faster options, your site must add the @docusaurus/faster package as a dependency`. Adding it is a new npm dependency, which needs approval.

### 6. Promotion dry run: passed offline; live fork run pending the user

No fork or GitHub release was made (outward action). Offline simulation in the session scratchpad:

| Step | Evidence |
|---|---|
| Fix release planned | `planDocsReleases` with stubbed GitHub answers (`wso2/docs-mi` has GA release `v4.4.0.1`) returns `[{"type":"fix","section":"integration-mi","version":"4.4.0","base":"4.4.0","tag":"v4.4.0.1","sha":"f62217f7…"}]` |
| Lock edit (the bot PR's content) | `applyDocsRelease` on a copy; `diff` shows only `ref: 4.4.0` -> `ref: v4.4.0.1` and `sha: 4ab09a6f…` -> `sha: f62217f7…` |
| Only that snapshot's key changes | `DOCS_SITE_LOCK=<copy> node scripts/snapshots.mjs list` vs the real lock: one line differs, `integration-mi--v4-4-0` `5b707974…` -> `4df45114…` |
| New version | `applyDocsRelease` type `new` adds 4.7.0 at the top (stand-in `ref: 4.6.0`, 4.6.0's sha) and drops `track: true` from 4.6.0. With `live_window: 1`, 4.6.0 becomes a snapshot at `integration/micro-integrator/4.6.0` and `snapshots.mjs list` gains exactly one line, `integration-mi--v4-6-0`; every other key is unchanged. At the earlier `live_window: 2` (run before the window changed) 4.6.0 became `live` at `/integration/micro-integrator/4.6.0/` and 4.5.0 joined the snapshots, as the brief expected |
| Unit tests | `node --test scripts/test/bump.test.mjs`: 5/5, including "a fourth-segment docs release is a fix for that version", "a newer docs release becomes Latest only when the product released it; Latest stops tracking" and "a fix release un-tracks the version it pins" |

Limits: no fork release was read through the GitHub API, and this repo has no remote, so no PR was opened.

## Measurements

All figures from `/usr/bin/time -l`. "Pages" are converted pages from `npm run content` unless marked `index.html`.

### Pipeline

| Step | Wall time | Max RSS |
|---|---|---|
| `npm run fetch` (every source, assets included, partly cached) | 1,142 s | 1.3 GB |
| `npm run content` (every section, 14 pilot versions) | 216 s | 0.8 GB |
| `npm run content -- identity integration-mi` | 160 s | 0.6 GB |

### Live build

| Run | Pages | Heap | Result | Wall time | Max RSS |
|---|---|---|---|---|---|
| Window 2: every product at Latest, IS and MI at Latest plus previous | 7,584 | 8 GB | Out of memory in webpack compile (old space 7.5 GB) | 1,173 s | 5.1 GB |
| Window 2, same | 7,584 | 12 GB | Server compiled in 22.4 min; out of memory in client compile (old space 11.8 GB) | 1,951 s | 6.1 GB |
| Window 2 with Faster (`future: { v4: true }`) | | | Not run: `@docusaurus/faster` not installed | | |
| Window 1: every product at Latest | 5,934 (6,273 `index.html`) | 8 GB | Out of memory (old space 7.8 GB) | 1,056 s | 5.7 GB |
| Window 1, same | 5,934 | 12 GB | **Success.** Server 13.7 min, client 28.1 min, then SSG | **2,839 s (47.3 min)** | 6.6 GB |

Max RSS understates memory here: the heap figures from V8's GC log are the better measure, and the machine was swapping (high system time: 2,643 s on the successful run). Output: `site/build` 7.2 GB.

### Extrapolation and the live-window threshold

Full live build at window 2 = every product at Latest (5,934) plus the previous release of each versioned section: Identity 7.2.0 (816) and MI 4.5.0 (834) measured, plus API Manager 4.6.0 (578), Streaming Integrator 4.3.1 (228), Kubernetes Gateway 1.2.0 (231), Open Banking 3.0.0 (117), API Gateway 1.1.0 (54) and AI Gateway 1.2.0 (76) from `research/02-version-inventory.md`. Total 8,868 pages.

| | Time | Memory |
|---|---|---|
| Scaled from window 1 (0.478 s per page) | 8,868 × 0.478 s ≈ 4,240 s, about 71 min (swap-inflated; an upper bound) | |
| Lower bound from the window-2 OOM | | Over 11.8 GB heap at 7,584 pages; scaled to 8,868 pages, at least 13.8 GB heap before non-heap memory, so likely over 14 GB (a lower-bound extrapolation from an out-of-memory run, not a measurement) |
| Threshold | 60 min | 14 GB |

Both limits are likely exceeded without Faster (time is swap-inflated and memory is a lower-bound extrapolation), and Faster cannot be measured without a new dependency. Under the rule (brief Step 2), `live_window` is now `1` (commit `3ab6fec`, also updates `docs-site/README.md`). Identity 7.2.0 and MI 4.5.0 became snapshots, with baselines in commit `1942d51`.

After the final fix wave, the window-1 live build took 34 min cold at a 5.6 GB peak and under 10 min warm (6.7 GB), with less swapping. Window 1 measured 47 minutes in Task 13, inside the 60-minute limit, and needs a heap between 8 and 12 GB. That is close to the 14 GB limit, and growth in Latest content will cross it.

### Snapshots (after the window change, this run)

Each figure covers build-content, the Docusaurus build, the baseline link check, pack and put.

| Snapshot | Wall time | Max RSS | Tarball | Baseline links |
|---|---|---|---|---|
| integration-mi--v4-5-0 (new, baseline recorded) | 255 s | 5.0 GB | 667.6 MB | 114 |
| integration-mi--v4-4-0 | 211 s | 4.5 GB | 659.2 MB | 110 |
| integration-mi--v4-3-0 | 128 s | 4.3 GB | 451.3 MB | 67 |
| integration-mi--v4-2-0 | 106 s | 6.7 GB | 232.9 MB | 32 |
| identity--v7-2-0 (new, baseline recorded) | 181 s | 4.6 GB | 272.7 MB | 84 |
| identity--v7-1-0 | 109 s | 4.4 GB | 231.9 MB | 92 |
| identity--v7-0-0 | 105 s | 3.7 GB | 180.7 MB | 90 |
| identity--v6-1-0 | 96 s | 5.2 GB | 114.2 MB | 204 |
| identity--v6-0-0 | 93 s | 4.4 GB | 112.6 MB | 203 |
| identity--v5-11-0 | 94 s | 4.0 GB | 131.5 MB | 48 |
| identity--v5-10-0 | 95 s | 4.1 GB | 120.0 MB | 49 |
| identity--v5-9-0 | 92 s | 4.3 GB | 99.9 MB | 46 |
| **Total** | **1,565 s (26 min)** | | **3.27 GB** | **1,139** |

A rebuild at an unchanged key prints `cached` in about a second. Times are higher than Task 10's (39 to 80 s) because this run followed the swapping live builds; Task 10's figures are the better per-snapshot estimate. Max RSS varies between runs by up to 2 GB (Task 10 saw 3.4 to 6.7 GB for the same builds).

### Images and output size

| | Before Task 8 | After Task 8 | Now |
|---|---|---|---|
| `generated/static` | 5.6 GB | 4.3 GB | 4.2 GB |
| `generated/static-versions` | 7.6 GB | 2.1 GB | 2.0 GB |
| Identity Latest static | 718 MB | 9.8 MB | 9.0 MB |
| MI Latest static (`<img>` tags stay absolute by design) | 1.3 GB (with stale files) | 718 MB | 649 MB |

| Output | Size |
|---|---|
| `site/build` (live, window 1) | 7.2 GB, of which `assets/` 2.4 GB |
| `site/build-merged` (live plus 12 snapshots) | 11 GB, 14,845 `index.html`, `assets/` 3.0 GB |
| Assembly (`snapshots.mjs assemble`) | 84 s, 99 MB RSS |
| Snapshot store `.cache/snapshots` (current keys) | 3.27 GB for 12 tarballs |

## Findings for the rollout

- **CI cannot run this pipeline as written.** `.github/workflows/docs-site-ci.yml` runs `npx docusaurus build site`, which skips `scripts/docusaurus.mjs` and its heap setting, so it gets Node's default heap and will run out of memory. A full live build needs about a 12 GB heap, more than a standard 16 GB `ubuntu-latest` runner can give comfortably, and `site/build` plus `site/build-merged` (18 GB) and `generated/` exceed the runner's free disk. The final `check-links.mjs site/build-merged` step exits 1 on the 2,461 pre-existing links. The job's 90-minute timeout is above the measured 47 minutes, but with little margin on slower runners.
- **Docusaurus Faster** is the obvious next lever on both time and memory. Trying it means adding `@docusaurus/faster` (a new dependency, needs approval) and re-testing the near-identical versioned MDX failure noted in `docusaurus.config.js`.
- **Source link breakage outside the gate filter** (the 136 links) should join ticket 14 (fix link conversion for older versions): root-relative links, the IS 6.x includes overshoot, and backslash image paths.
