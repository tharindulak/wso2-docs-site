# Rollout measurements

Rollout of versions to every product (`live_window: 1`, 33 snapshot versions). Branch `docs-site-versions`, measured 2026-10-11 on the same 16 GB macOS machine as `10-pilot-measurements.md` (Node 22.23). Page counts are `index.html` files. Build time and peak memory (max RSS from `/usr/bin/time -l`) come from the per-version logs: each covers `snapshots.mjs build` (content, Docusaurus build, baseline check, pack, put). Some versions were built or re-run while other work ran, so times vary; treat them as indicative.

## Live build

| Step | Pages (`index.html`) | Heap | Wall time | Max RSS |
|---|---|---|---|---|
| `docusaurus.mjs build site` (`DOCS_HEAP_MB=12288`, every product at Latest) | 6,691 | 12 GB | 1,343 s (22.4 min) | 6.5 GB |
| `snapshots.mjs assemble site/build site/build-merged` (33 snapshots) | 24,754 in the merged output | | 230 s | 90 MB |
| `check-links.mjs site/build-merged --baselines link-baselines` | | | 30 s | 434 MB |

The live build is faster than the pilot's 47 min (a quieter machine, little swap). The 14 GB threshold and the 12 GB heap need are unchanged.

## Snapshots

| Snapshot | Pages | Build time | Max RSS | Tarball |
|---|---|---|---|---|
| integration-mi--v4-5-0 | 852 | 213 s | 3.5 GB | 668.2 MB |
| integration-mi--v4-4-0 | 836 | 191 s | 3.5 GB | 659.8 MB |
| integration-mi--v4-3-0 | 746 | 167 s | 3.5 GB | 451.9 MB |
| integration-mi--v4-2-0 | 631 | 166 s | 3.7 GB | 233.2 MB |
| integration-si--v4-3-1 | 233 | 84 s | 3.7 GB | 42.0 MB |
| integration-si--v4-3-0 | 233 | 80 s | 4.1 GB | 46.0 MB |
| identity--v7-2-0 | 820 | 161 s | 3.5 GB | 277.0 MB |
| identity--v7-1-0 | 737 | 158 s | 3.6 GB | 235.8 MB |
| identity--v7-0-0 | 564 | 124 s | 3.3 GB | 184.4 MB |
| identity--v6-1-0 | 786 | 148 s | 3.2 GB | 114.3 MB |
| identity--v6-0-0 | 782 | 152 s | 3.5 GB | 112.7 MB |
| identity--v5-11-0 | 640 | 124 s | 4.0 GB | 149.3 MB |
| identity--v5-10-0 | 615 | 146 s | 3.7 GB | 137.8 MB |
| identity--v5-9-0 | 563 | 142 s | 2.9 GB | 121.0 MB |
| api-platform-api-gateway--v1-1-0 | 101 | 78 s | 2.7 GB | 5.3 MB |
| api-platform-api-gateway--v1-0-0 | 95 | 108 s | 3.0 GB | 4.8 MB |
| api-platform-ai-gateway--v1-2-0 | 178 | 90 s | 2.8 GB | 6.1 MB |
| api-platform-ai-gateway--v1-1-0 | 82 | 81 s | 2.7 GB | 5.1 MB |
| api-platform-ai-gateway--v1-0-0 | 72 | 33 s | 6.3 GB | 3.1 MB |
| api-platform-apim--v4-6-0 | 578 | 136 s | 3.7 GB | 518.3 MB |
| api-platform-apim--v4-5-0 | 519 | 112 s | 4.2 GB | 486.8 MB |
| api-platform-apim--v4-4-0 | 468 | 131 s | 3.1 GB | 431.1 MB |
| api-platform-apim--v4-3-0 | 751 | 147 s | 2.8 GB | 711.0 MB |
| api-platform-apim--v4-2-0 | 1465 | 232 s | 2.8 GB | 987.5 MB |
| api-platform-apim--v4-1-0 | 1427 | 196 s | 3.1 GB | 813.1 MB |
| api-platform-apim--v4-0-0 | 1398 | 181 s | 4.7 GB | 655.3 MB |
| api-platform-apim--v3-2-0 | 434 | 122 s | 2.8 GB | 415.8 MB |
| api-platform-apim--v3-1-0 | 400 | 152 s | 2.8 GB | 350.2 MB |
| api-platform-apim--v3-0-0 | 382 | 67 s | 2.2 GB | 315.1 MB |
| kubernetes-gateway--v1-2-0 | 231 | 63 s | 4.5 GB | 41.8 MB |
| kubernetes-gateway--v1-1-0 | 194 | 86 s | 3.6 GB | 37.2 MB |
| kubernetes-gateway--v1-0-0 | 133 | 54 s | 5.3 GB | 13.9 MB |
| financial-services--v3-0-0 | 117 | 40 s | 5.8 GB | 18.7 MB |
| **Total (33)** | **18063** | | | **9.25 GB** |

Per-snapshot work for apim 4.0.0 to 4.2.0 (about 1,400 pages each) is the heaviest; Financial Services 3.0.0 and Kubernetes Gateway 1.0.0 peaked highest (5.3 to 5.8 GB) with few pages. Peaks stay under 6.3 GB.

## Disk

| Item | Count | Size |
|---|---|---|
| Current-key snapshot tarballs (`.cache/snapshots`) | 33 | 9.25 GB |
| Stale tarballs (no current key names them; not deleted, awaiting approval) | 39 | 9.59 GB |
| `.cache/snapshots` total (`du`) | 72 | 18 GB |
| `site/build-merged` | 24,754 `index.html` | 16 GB |
| `site/build` (live) | 6,691 `index.html` | 7.2 GB |
| `.cache/sources` | 38 checkouts | 37 GB |
| `.cache` total | | 55 GB |

Free disk after all of this: 28 GB of 460 GB. A CI runner needs about 16 GB for the merged output plus the live build, sources and snapshot downloads on top.

## Merged link check

`node scripts/check-links.mjs site/build-merged --baselines link-baselines` found 6,270 broken internal links: 5,786 in baselines, **484 new**, exit 1 before re-recording.

Classification of the 484 (from the review): about 140 are converter-caused, the rest source content.

| Group | Links | Cause |
|---|---|---|
| Former-site root-relative `/en/<ver>/...` paths (API Manager 4.5.0 and 4.6.0; 86 are assets) | 104 | Converter for 102: the target exists and the link works on the former site, but the converter rewrites only `https?://` links. The other 2 are source (target missing) |
| `{{base_path}}/en/{{site_version}}/...` with a host-only `base_path` (Kubernetes Gateway home) | 1 | Converter |
| AI Gateway `README.md` published as a `README/` page, so relative links shift a level | 5 | Converter (routing) |
| Cross-component `.md` links into `next/` trees this site does not host (output `.../next/x.md/`) | 30 | Converter fallback: the targets exist in source |
| Relative links that climb above the version root (122 on `includes/` fragment pages, 8 on normal pages) | 130 | Source; they break the same way on the former site |
| Root-relative paths without `/en/<ver>/` (`/install-and-setup/...`, `/design/...`) | 155 | Source |
| Relative images that climb too far (8 on `includes/` pages, 8 on normal pages) | 16 | Source |
| Other: typos (`4.1.0}/`, `3.0.0learn/`), missing pages and anchors, `choreo-connect`, MI, SI, FS and k8s paths | 43 | Source |

Total: 140 converter-caused, 344 source. The converter-caused links are baselined in `live.json` pending the "Fix link conversion" ticket (issue 14); they are not accepted as source breakage. The per-version gate keeps only targets under `/<route>/` or `/assets/`, so these were caught only by the merged check.

By page: 435 on snapshot pages, 49 on live pages. Recorded with `--record-live` (`link-baselines/live.json`: 1,497 to 1,834 entries; entries that no longer break were dropped). After re-recording the check prints `6270 broken internal link(s), 6270 in baselines, 0 new`, exit 0.

## Defect found and fixed

`snapshots.mjs assemble` failed with `spawnSync tar ENOBUFS` when it listed the API Manager tarballs (a verbose `tar -tvzf` listing larger than Node's 1 MiB default buffer). The tar helper now sets `maxBuffer` to 1 GiB, with a test that lists more than 1 MiB. Snapshot keys do not cover `scripts/snapshots.mjs`, so no snapshot was invalidated (`list --missing` still prints nothing).

## Final rebuild (after Tasks 6 and 7)

- Live build (DOCS_HEAP_MB=12288, live_window 1): 1014.8 s real, peak RSS 6.25 GB, exit 0.
- Snapshots: 33 rebuilt, all passed first time, total 2547 s (about 42 min).
- Gate (assemble strict, check-links with baselines): 6063 broken, 6063 in baselines, 0 new, exit 0, before and after the shrink.
- Baseline totals: 6078 before, 6063 after (live.json 1681 -> 1674; eight APIM version files -1 each). Commit 269bcc0.
- File-id H1 count on site/build: 56 of 6689 pages (H1 equals folder name; sampled ones are real titles such as CVE ids and CRD names).

## Final rebuild 2

BLOCKED before the gate. npm test 71/71. Live build did not complete: first attempt thrashed 4 h (22 min CPU, stopped); rerun compiled the server in 1.07 h, then made about 0.5 CPU min in 16 min with swap 29.3/29.7 GB, and was stopped (about 5 h wall). No valid live time or peak memory. Snapshots: 4 of 32 built (MI 4.5.0 156 s, 4.4.0 257 s, 4.3.0 1049 s, 4.2.0 about 47 min), all gates passed without re-recording. Baselines unchanged: 4389 per-version links, 470 literal sequences on 242 pages, 1674 live. No proof counts (nothing added). The earlier "1014.76 s" figure was a stale log and is invalid.

## Final rebuild 2 (after restart)

Replaces the invalid figures in "Final rebuild 2" above. Machine restarted (swap 0 at start). Passed, exit 0, 0 new.

- npm test 71/71 before; 126 and 71 pass after (two test runs reported); `npm run content` ok.
- Live build (DOCS_HEAP_MB=12288, live_window 1), from this run's log: 570.58 s real, max RSS 6.66 GB, exit 0. Swap used peaked near 12 GB during the live build (sampled every 4 min) and was 2.8 GB after; it stayed under 4 GB for every later step.
- Snapshots: 29 built sequentially, all stored. Total build time 2520 s (42 min), including the failing first build of each re-recorded snapshot and three repeat attempts. Per snapshot (first build, s): si 4.3.1 40, 4.3.0 27; identity 7.2.0 68, 7.1.0 63, 7.0.0 56, 6.1.0 51, 6.0.0 51, 5.11.0 56, 5.10.0 55, 5.9.0 53; api-gateway 1.1.0 27, 1.0.0 27; ai-gateway 1.2.0 26, 1.1.0 26, 1.0.0 22; apim 4.6.0 59, 4.5.0 74, 4.4.0 68, 4.3.0 87, 4.2.0 127, 4.1.0 115 (retry 90), 4.0.0 110, 3.2.0 49 (retry 36), 3.1.0 45, 3.0.0 44; kubernetes-gateway 1.2.0 30, 1.1.0 31, 1.0.0 28; financial-services 3.0.0 29. Re-record builds add 29 to 129 s each (13 snapshots).
- `assemble site/build site/build-merged` strict: 227 s, max RSS 0.13 GB, exit 0. Merged check: 36 s, 0.76 GB.
- Gate, before recording: 6115 broken, 6091 in baselines, 24 new; literal Markdown 47 sequences on 42 pages, 0 over the baseline. After `--record-live` and after committing: 6115 broken, 6115 in baselines, 0 new, exit 0.
- Baseline totals, before to after:
  - Per-version links: 4389 to 4417 (13 files; 39 entries added, 11 no longer broken).
  - live.json: 1674 to 1698 (24 added, 0 removed).
  - literal-markdown.json: 470 sequences on 242 pages to 47 on 42 pages; no entry added. The API Gateway four-CPU pages (live and 1.1.0) have no literal Markdown (4 images each).
- Added entries: 63 (39 per-version + 24 live). 56 of 63 proven by script or by manual check against the pinned source: targets missing or malformed (doubled `images/images/`, `{{base_path}}` paths to moved pages, multi-line link targets, `.md.md`, `{{ product_name }}` paths that resolve to a name with spaces, a template variable naming a missing page). 7 entries (4 in API Manager 4.1.0 and 3 in the live check, all 7 with a target that exists in the source tree) are root-relative paths without the `/en/<version>/` prefix (`/assets/img/streaming/...`, `/api-analytics/choreo-analytics/...`), ruled by the controller as source breakage; the former site could not be fetched (HTTP 403 for every URL, including valid ones), so 404 on the former site is inferred from its URL scheme, not measured.
- Commits: 3432089 (per-version baselines), f89c0f5 (live and literal-Markdown baselines).
