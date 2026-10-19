# 02 Version inventory (researched 2026-10-09)

Answers [ticket 02](../issues/02-version-inventory.md). Sources: GitHub API via `gh` and `git ls-remote` (read-only), current docs sites via WebFetch. Items marked **[unverified]** are inference, not confirmed in a primary source.

## How to read this

- **Published list.** The current MkDocs sites do not serve a static `versions.json`. Their theme JS fetches `<site>/versions/assets/versions.json`, which each repo keeps on a `versions` branch (`en/docs/assets/versions.json`). Docs-is moved its list into `en/identity-server/is_common.yml` (`extra.versions`); its `versions` branch is stale (last commit 2023-06-14, current 6.1.0). The SI site is a `mike` deploy on `gh-pages` with its own root `versions.json`.
- **Live check.** The `*.docs.wso2.com` hosts sit behind a Cloudflare challenge: `curl` gets 403. WebFetch reached most pages. Spot-checked live: IS versions page, IS 5.9.0, APIM 3.0.0, MI 4.2.0, MI latest, APK latest and 2.0.0, OB latest and 3.0.0, SI, BI. `apim.docs.wso2.com/en/latest/versions/` returned 403 to WebFetch too.
- **Commit.** Branch or default-branch head on 2026-10-09 (`gh api repos/wso2/<repo>/commits/<ref>`). Pins in `docs-site/content-sources.yaml` are noted where they differ.
- **Pages.** Count of `.md` (or `.md`/`.mdx` for Docusaurus) files under the docs dir at that commit, from the recursive git tree (none truncated). It includes snippet and include files, so it overstates rendered pages slightly.
- **Era.** `mkdocs` / `mkdocs-material` pins from `requirements.txt`, plus mkdocs.yml shape (`INHERIT`, palette, `site_name`).
- **GA.** Non-prerelease GitHub release on the product repo (`gh release list -L 100`). "Not in the latest 100 releases" means not checked further back.
- **Archive candidate.** Listed on the current site but with no source in any docs repo. In every case found, these link off-site to Confluence (`wso2docs.atlassian.net`), which still serves (HTTP 200 for IS580).

## Identity Server (wso2/docs-is, product wso2/product-is)

Selector (`is_common.yml` at master `c2176fcd1b50`): 7.3.0 to 6.0.0. Versions page (`is.docs.wso2.com/en/versions/`, fetched live) also lists 5.11.0 to 5.0.0. Source is version folders on master; release branches 5.9.0 to 6.1.0 also exist but the folders are what master builds.

| Version | Source (docs-is master `c2176fcd1b50`) | GA release | Pages | Era | Notes |
|---|---|---|---|---|---|
| 7.3.0 (current) | `en/identity-server/7.3.0/` | v7.3.0 (2026-05-13) | 851 | `INHERIT: ../is_common.yml` -> `../base.yml`; mkdocs 1.5.3, material 9.1.2; shared `en/includes` (726 files) | Matches lock-file pin |
| 7.2.0 | `en/identity-server/7.2.0/` | v7.2.0 (2025-10-24) | 818 | same as 7.3.0 | |
| 7.1.0 | `en/identity-server/7.1.0/` | v7.1.0 (2025-02-28) | 735 | same | |
| 7.0.0 | `en/identity-server/7.0.0/` | v7.0.0 (2024-03-04) | 564 | same | release notes under `references/` |
| 6.1.0 | `en/identity-server/6.1.0/` (also branch `6.1.0` `918901905975`) | v6.1.0 (2023-01-30) | 786 | standalone mkdocs.yml, `palette.scheme: preference`; material 4.2.0 | |
| 6.0.0 | `en/identity-server/6.0.0/` (also branch `6.0.0` `ee0f1bd1efc2`) | v6.0.0 (2022-08-16) | 782 | as 6.1.0 | |
| 5.11.0 | `en/identity-server/5.11.0/` (also branch) | not in the latest 100 releases | 640 | standalone, `primary: deep-orange`; material 4.2.0 | versions page only, not in selector |
| 5.10.0 | `en/identity-server/5.10.0/` (also branch) | not in the latest 100 releases | 615 | as 5.11.0 (mkdocs 1.5.3) | versions page only |
| 5.9.0 | `en/identity-server/5.9.0/` (also branch) | not in the latest 100 releases | 563 | as 5.11.0 | versions page only; live check OK |
| 5.8.0 to 5.0.0 (10: 5.8.0, 5.7.0, 5.6.0, 5.5.0, 5.4.1, 5.4.0, 5.3.0, 5.2.0, 5.1.0, 5.0.0) | none; Confluence `wso2docs.atlassian.net/wiki/spaces/IS5x0` | not in the latest 100 releases | n/a | Confluence | **archive candidates** |

Also on master: `en/identity-server/next/` (866 pages, unreleased) and `versions/` (the versions page). Branch `5.12.0` (2022-05-17) is not published.

## API Manager (wso2/docs-apim, product wso2/product-apim)

Published list: `versions` branch `d59c5132d0ca` (2026-04-29), `en/docs/assets/versions.json`: current 4.7.0, selector 4.7.0 to 3.0.0, plus Confluence entries.

| Version | Source branch @ head | GA release | Pages | Era | Notes |
|---|---|---|---|---|---|
| 4.7.0 (current) | `4.7.0` @ `75726eb0a49d` (2026-10-01) | v4.7.0 (2026-04-29) | 595 | mkdocs 1.5.3, material 9.1.2; `site_name` without version | Lock file pins master `e4e26c4c20c1` (2026-09-29); branch is 2 days newer |
| 4.6.0 | `4.6.0` @ `d74917be6283` (2026-10-02) | v4.6.0 (2025-11-04) | 578 | as 4.7.0 | |
| 4.5.0 | `4.5.0` @ `44d25ebbffaf` | v4.5.0 (2025-03-17) | 519 | mkdocs 1.4.2, material 9.1.2, `prefers-color-scheme` palette | |
| 4.4.0 | `4.4.0` @ `808c7e57d4d9` | v4.4.0 (2024-10-30) | 468 | as 4.5.0, versioned `site_name` | |
| 4.3.0 | `4.3.0` @ `3b3ebf8fcc12` | v4.3.0 (2024-04-10) | 751 | as 4.4.0 | |
| 4.2.0 | `4.2.0` @ `3dd871cfa2b6` | v4.2.0 (2023-03-22) | 1,465 | as 4.4.0 | |
| 4.1.0 | `4.1.0` @ `78771a76543b` | v4.1.0 (2022-04-05) | 1,427 | mkdocs 1.0.4, material 4.5.1, `primary: deep-orange` | |
| 4.0.0 | `4.0.0` @ `5a85a65d8d6d` | v4.0.0 (2021-05-01) | 1,398 | as 4.1.0 | |
| 3.2.0 | `3.2.0` @ `c421978b28ec` | v3.2.0 (2020-08-25) | 434 | as 4.1.0 | |
| 3.1.0 | `3.1.0` @ `f110c268108d` | v3.1.0 (2020-03-25) | 400 | as 4.1.0 | |
| 3.0.0 | `3.0.0` @ `53584be9c5ba` | v3.0.0 (2019-10-29) | 382 | as 4.1.0 | live check OK |
| 2.6.0, 2.5.0, 2.2.0, 2.1.0, 2.0.0, 1.10.0, 1.9.1, 1.9.0 (8) | none; Confluence `spaces/AM*` | not in the latest 100 releases | n/a | Confluence | **archive candidates** (versions page only) |

Noise to exclude by allow-list: `4.3.0-improvements`, `4.5.0-new`, `4.5.0-org-feature`, `4.6.0-backup`, `4.6.0-revamp`, `revamp-4.6.0`, `master-backup-4.6.0`, `staging-*` (449 branches total).

**Parallel effort found:** wso2/docs-api-platform has per-version branches `apim-3.0.0` to `apim-4.7.0` (2026-09-14), each holding APIM docs under `en/docs/api-manager/<v>/` (594 pages for 4.7.0) with a `Dockerfile.<v>` that trims nav to one version. Not what `apim.docs.wso2.com` serves today [unverified]. **Supply-chain flag:** these branches and `api-gateway-1.2.0` install `docs-shared-hooks @ git+https://github.com/senthuran16/docs-api-platform.git@shared-v5`, a personal fork; their own README says it must move to a WSO2 repo. Main does not have this pin.

## Micro Integrator (wso2/docs-mi, product wso2/micro-integrator)

Published list: `versions` branch `89583cc5f5c2` (2026-05-15), also copied at `en/docs/versions/assets/versions.json` on main. Theme JS on main fetches it from `raw.githubusercontent.com/wso2/docs-mi/versions/...`.

| Version | Source branch @ head | GA release | Pages | Era | Notes |
|---|---|---|---|---|---|
| 4.6.0 (current, `/en/latest/`) | `4.6.0` @ `16f84ae6e39b` (2026-10-06) | v4.6.0 (2026-05-15) | 875 | mkdocs 1.4.2, material 9.1.2; "WSO2 Integrator: MI" name | versions.json maps 4.6.0 to `main`, but main now says 4.7.0 |
| 4.5.0 | `4.5.0` @ `f62217f74a43` | v4.5.0 (2025-10-27) | 834 | as 4.6.0, "WSO2 Integrator: MI" rebrand | |
| 4.4.0 | `4.4.0` @ `4ab09a6fce74` | v4.4.0 (2025-02-19) | 818 | as 4.6.0, "WSO2 Micro Integrator" name | |
| 4.3.0 | `4.3.0` @ `5b4f5a8f5e9b` | v4.3.0 (2024-07-24) | 746 | as 4.4.0 | |
| 4.2.0 | `4.2.0` @ `840cd49e8494` | v4.2.0 (2023-04-26) | 631 | as 4.4.0 | live check OK |

Main (`ce68011aab5f`, lock-file pin) is labelled 4.7.0 (875 pages); no 4.7.0 GA exists. Older MI (1.x, 4.0, 4.1) is not in the selector; MI 1.x lived inside EI 7.x docs (wso2/docs-ei branches `7.0.0`, `7.1.0`, 755 and 877 pages, `ei.docs.wso2.com`), out of scope unless the team wants it.

## Streaming Integrator (wso2/docs-si, product wso2/streaming-integrator)

Published list: `mike` deploy on `gh-pages` (`88c2f1143b3a`, 2026-07-28) root `versions.json`: 4.4.0 (alias latest), 4.3.1, 4.3.0 ("4.3.0 and older"). The `versions` branch agrees.

| Version | Source branch @ head | GA release | Pages | Era | Notes |
|---|---|---|---|---|---|
| 4.4.0 (latest) | `4.4.0` @ `da39e8ce69ed` (2026-05-14) | v4.4.0 (2026-05-15) | 222 | mkdocs 1.4.2, material 9.1.2, "WSO2 Integrator: SI" | main `9c75a9781262` (lock pin) is also 4.4.0 |
| 4.3.1 | `4.3.1` @ `c6acd40667d0` | v4.3.1 (2025-08-06) | 228 | as 4.4.0 | |
| 4.3.0 | `4.3.0` @ `09e25e709468` | v4.3.0 (2025-03-18) | 233 | as 4.4.0, "WSO2 Streaming Integrator" name, no `site_url` | labelled "4.3.0 and older" |

Built HTML for all three already exists on `gh-pages` (folders `4.3.0`, `4.3.1`, `4.4.0`). SI GA 4.2.0 and older have no docs version.

## Kubernetes Gateway (wso2/docs-apk, product wso2/apk)

Published list: `versions` branch `b321f595dc28` (2025-03-17): current 1.3.0, list 1.3.0 to 1.0.0.

| Version | Source branch @ head | GA release | Pages | Era | Notes |
|---|---|---|---|---|---|
| 1.3.0 (current, `/en/latest/`) | `1.3.0` @ `7dbf5736c5c7` (2026-08-31) | 1.3.0 (2025-03-17), 1.3.0-1 (2025-10-05) | 252 | mkdocs 1.4.2, material 9.1.2, "Kubernetes Gateway" name | |
| 1.2.0 | `1.2.0` @ `5e49408a2b70` | 1.2.0 (2024-10-30) | 231 | as 1.3.0, "APK Documentation" name | |
| 1.1.0 | `1.1.0` @ `9b05063c2fe6` | 1.1.0 (2024-04-10) | 194 | as 1.2.0 | |
| 1.0.0 | `1.0.0` @ `83d175c04f75` | 1.0.0 (2023-10-04) | 133 | as 1.2.0 | |
| 2.0.0 (live, not in selector) | `2.0.0` @ `833ba0222562` (2025-12-15) | none in wso2/apk | 251 | as 1.3.0 | `apk.docs.wso2.com/en/2.0.0/` serves; the latest-page banner links 2.0.0 to `wso2.com/api-platform/docs/api-gateway/...` |

**Lock-file mismatch:** `content-sources.yaml` pins main `15660917a3ac`, which is labelled "APK Documentation 1.2.0" (230 pages). The live Latest is 1.3.0 from branch `1.3.0`.

## Open Banking / Financial Services (wso2/docs-open-banking, product wso2/financial-services-accelerator)

Published list: `versions` branch `56e9e64e9efc` (2025-06-13): current 4.0.0, list 4.0.0, 3.0.0, plus Confluence.

| Version | Source branch @ head | GA release | Pages | Era | Notes |
|---|---|---|---|---|---|
| 4.0.0 (current, `/en/latest/`) | ambiguous: `4.0.0` @ `753b7cd9fd33` (2025-08-27, 167), `v4.0.0` @ `7e218756fa3a` (2025-05-19, 112), master @ `81100957b685` (2026-08-13, 179, lock pin) | v4.0.0 (2025-06-03); v4.1.0, v4.1.1 have no docs version | 167 to 179 | `requirements.txt` at repo root, mkdocs>=1.1, material>=4.6.3 (unpinned); `primary: deep-orange` | confirm with team which ref is live |
| 3.0.0 | `3.0.0` @ `ec9a0315c50a` (2026-08-18) | not in the latest 100 releases (they start at v3.3.0) | 117 | as 4.0.0 | live check OK |
| 2.0.0, 1.5.0, 1.4.0, 1.3.0 (4) | none; Confluence `spaces/OB*` | not in the latest 100 releases | n/a | Confluence | **archive candidates** (versions page only) |

## WSO2 Integrator: BI (wso2/docs-bi, product wso2/product-ballerina-integrator)

| Version | Source | GA release | Pages | Era | Notes |
|---|---|---|---|---|---|
| unversioned (only version) | main @ `b5618c07948f` (2026-05-06, lock pin); deployed to `gh-pages` `1cc44b386bb3` same day | latest GA v1.7.0 (2026-02-13) | 102 | mkdocs 1.4.2, material 9.1.2; no `site_version` | Live site has no selector (WebFetch); `/1.5.0/` returns 404 |

Unpublished branches `docs-1.3.0` (73), `docs-1.4.0` (73), `docs-1.5.0` (84), `docs-1.6.0-stage` (95). No `versions` branch. Theme JS would fetch `versions/assets/versions.json` but nothing publishes one.

## WSO2 Integrator (wso2/docs-integrator, product wso2/product-integrator)

| Version | Source | GA release | Pages | Era | Notes |
|---|---|---|---|---|---|
| unversioned (only version) | main @ `0420342f8bcd` (2026-10-07, lock pin) | v5.0.0 (2026-05-12); v5.1.0 only m1 | 1,164 | Docusaurus 3.9.2, no versioning plugin config | No selector on `wso2.com/integration-platform/docs/` |

Branches `5.0.x` @ `bcbf0ad43756` (2026-09-21, 1,073) and `5.1.x` @ `32a10a928139` (2026-10-09, 1,129) look like release lines but are not published as versions.

## Agent Manager (wso2/docs-agent-platform, product wso2/agent-manager)

Docusaurus `versions.json` on main: `["v1.0.0", "cloud"]`. `docusaurus.config.ts` sets `lastVersion` to the first `v*` entry and keeps `current` as "Next" (unreleased banner).

| Version | Source (main @ `58da5a82a4d1`, lock pin) | GA release | Pages | Era | Notes |
|---|---|---|---|---|---|
| v1.0.0 (latest) | `versioned_docs/version-v1.0.0` | amp/v1.0.0 (2026-09-07) | 72 | Docusaurus versioned docs | |
| cloud | `versioned_docs/version-cloud` | n/a (cloud) | 38 | as above | pseudo-version, cloud stays Latest only |
| Next | `docs/` | unreleased | 74 | as above | |

Older pre-release snapshots (v0.x, v1.0.0-rc*) were removed on 2026-09-14 (commit `97b09eecefe4`, "remove the old doc versions"). All v0.x releases are pre-releases, so nothing is lost.

## API Platform components (wso2/docs-api-platform, product wso2/api-platform)

Site `wso2.com/bijira/docs/` shows per-component selectors (WebFetch). Version folders on main; head is now `19dc5903be4e` (2026-10-09), lock pins `f7a46e1d7d8b`.

| Component | Version | Source folder | GA release (wso2/api-platform) | Pages |
|---|---|---|---|---|
| API Gateway | 1.2.0 (newest GA) | `en/docs/api-gateway/1.2.0/` | gateway/v1.2.0 (2026-08-06) | 58 |
| API Gateway | 1.1.0 | `en/docs/api-gateway/1.1.0/` | gateway/v1.1.0 (2026-04-30) | 54 |
| API Gateway | 1.0.0 | `en/docs/api-gateway/1.0.0/` | helm-gateway-1.0.0 (2026-04-06) only [unverified] | 51 |
| AI Gateway | 2026.09.24 (newest GA) | `en/docs/ai-gateway/2026.09.24/` | ai-gateway/v2026.09.24 (2026-09-24) | 86 |
| AI Gateway | 1.2.0 | `en/docs/ai-gateway/1.2.0/` | ai-gateway/v1.2.0 (2026-08-06) | 76 |
| AI Gateway | 1.1.0 | `en/docs/ai-gateway/1.1.0/` | ai-gateway/v1.1.0 (2026-04-30) | 46 |
| AI Gateway | 1.0.0 | `en/docs/ai-gateway/1.0.0/` | not in last 100 releases [unverified] | 41 |
| API Portal | 1.0.0 | `en/docs/api-portal/1.0.0/` | api-portal/v1.0.0 (2026-08-06) | 72 |
| AI Workspace | 1.0.0 | `en/docs/ai-workspace/1.0.0/` | portals/ai-workspace/v1.0.0 (2026-08-06) | 63 |

Each component also has `next/`. Branches `api-gateway-1.0.0` to `1.2.0`, `ai-gateway-1.0.0` to `1.2.0`, `api-portal-1.0.0`, `ai-workspace-1.0.0` mirror these (see the supply-chain flag under API Manager). Era: one mkdocs.yml, material theme, `nav_pick` in the lock file selects one release per component.

## Single-version sections

| Section | Repo @ head | Pages | Versioning |
|---|---|---|---|
| Accelerator for Healthcare | open-healthcare-docs main `e2512a025498` | 101 | Docusaurus, no `versioned_docs`; no selector live |
| Updates | docs-updates master `0e2e93c9030a` | 36 | single "2.0" site; branch `2.0.0` (2024-11-21, 21) plus backups |
| Platform Security | docs-security main `3d32fdf9ef19` (lock pins `f2bf5be51976`) | 491 | single; `site_version: 1.0.0` |

## Totals

| | Versions | Pages |
|---|---|---|
| With source (all rows above with a ref, excluding Next/next) | 51 | about 23,300 `.md` files |
| No source (Confluence links) | 22 (IS 10, APIM 8, OB 4) | n/a |

Lower than the map's "over 25,000" because this counts one ref per version; snippet files inflate it slightly, so rendered pages are fewer still.

## Open questions for the team

1. OB 4.0.0: which of `4.0.0`, `v4.0.0`, master is live.
2. APK: should Latest be 1.3.0 (branch) or 2.0.0, and should the lock file move off main (labelled 1.2.0).
3. Should Confluence-only versions be archived at all, given they are not on the current docs sites but on `wso2docs.atlassian.net`.
4. Status of the docs-api-platform `apim-*` branch experiment and the personal-fork dependency.
