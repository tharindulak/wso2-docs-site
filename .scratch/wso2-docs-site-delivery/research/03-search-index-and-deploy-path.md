# Search index and deploy path in the existing scripts

Ticket: "Search index and deploy path in the existing scripts". Read-only investigation of `docs-site/` at commit `c38fbf0` (branch `docs-site-build`). Repo facts cite `path:line`; external facts cite URLs. Items marked **[unverified]** or **[inference]** need a test or a primary source before they are relied on.

## Short answers

1. **Build without moving the alias?** No. `publish()` creates the collection, imports, moves the alias `docs` and drops the others in one call, and the CLI has only "publish" and `--dry-run` (records to a file, no Typesense). Minimal change: split `publish()` into `index` (create and import, print the collection name), `promote <collection>` (alias PUT, search key, analytics) and `prune --keep <n>` (drop all but the alias target and the newest n). About 40 lines in `search-index.mjs`. `search-config.json` names the alias, not the collection, so promoting needs no rebuild of the site.
2. **Drop before or after the alias moves?** After. The alias moves at `search-index.mjs:230`, then every other `docs_<14 digits>` collection is deleted (`:231-233`). On a symlink rollback the previous release's collection is already gone, and the alias still points at the newer index. The rolled-back site then searches the newer index and can show results for pages it does not have. A rollback that keeps search consistent needs the previous collection kept (`prune --keep 1` or more) and its name stored with each release, so rollback = repoint symlink + `promote <stored name>`.
3. **Deploy sequence.** Checkout the exact commit (clean tree), Node 22, `npm ci --ignore-scripts`, `node scripts/fetch-sources.mjs`, `npm run content`, `npm run build` (12 GB heap), `snapshots.mjs assemble site/build site/build` with `SNAPSHOT_STORE=github-release:docs-site-snapshots` and no `--allow-missing`, `check-links.mjs site/build --baselines link-baselines`, then index (build-only) and ship. The only measured numbers are: full build 15 to 50 minutes (47 on a 16 GB laptop before Docusaurus Faster), Faster peak memory 4.6 GB, merged output about 11 GB on disk, and indexing about 1 to 2 minutes for about 134,000 records (about 350 MB in Typesense). There are no CI timings: Actions is disabled on this repository and the snapshot release does not exist yet. Disk is the tight resource: about 11 GB of merged output against about 14 GB of runner SSD.
4. **workflow_run and head_sha.** Yes. The triggered run gets `github.event.workflow_run.head_sha`. `GITHUB_SHA` in the triggered run is the default branch head, not the commit that was built, so the deploy must check out `head_sha`. With matrix `[]`, `build` and `upload` are skipped by their `if:` conditions (`docs-site-snapshots.yml:39,69`), and a skipped job reports "Success". The run should therefore conclude `success` and fire `workflow_run` **[inference: GitHub documents the job status, not the run conclusion; test once]**. `workflow_run` fires for any conclusion, so the deploy must filter on `conclusion == 'success'`. Blockers in this repo: the snapshots workflow listens on `main` and `docs-site-versions`, but the default branch is `docs-site-build`. Bump merges made with `GITHUB_TOKEN` may not trigger it at all.
5. **site.url from env.** Change `docusaurus.config.js:85` to read a validated env variable (for example `DOCS_SITE_URL`, an https origin without a path). Derived from it: `<link rel="canonical">` and `og:url` on every page, every `<loc>` in `sitemap.xml`, and the host in the search-outage DuckDuckGo link. The search index stores root-relative URLs, so it does not depend on `url`. Catch: snapshots render canonical and `og:url` too, but their key hashes the config file, not the env value. The snapshots workflow must therefore set the same value, or the value must go into the key.

## 1. Can the indexer build a collection without moving the alias?

What the code does today:

- The CLI has two modes only: `--dry-run <out.jsonl>` writes records to a file and never contacts Typesense, and the default mode publishes (`search-index.mjs:290-314`). There is no flag to stop before the alias moves.
- `publish()` does everything in sequence (`search-index.mjs:209-238`):
  1. `POST /collections` with name `docs_<YYYYMMDDhhmmss>` (`:211-212`).
  2. Imports in batches of 2,000 with `action=create`, failing on any rejected record (`:213-225`). On failure, it deletes the new collection, and the alias stays on the last good index (`:226-229`).
  3. `PUT /aliases/docs` to the new collection (`:230`).
  4. Deletes every other collection matching `^docs_\d{14}$` (`:231-233`).
  5. `ensureSearchKey` creates the search-only key scoped to `docs` (`:240-248`), and `ensureAnalytics` sets up rules on the alias (`:254-272`).
- `writeConfig` writes `search-config.json` with `collection: 'docs'`, the alias, into the build dir and `.cache/search-public/`. It runs before indexing, as validation (`:281-288`, `:312`). The browser therefore never knows the collection name.
- The header comment states the design: "Each run indexes into a new collection docs_<timestamp>, points the alias `docs` at it and drops older ones" (`:13-14`; README `docs-site/README.md:82`).

Minimal change (proposal, not implemented):

| Command | Does | Code reused |
|---|---|---|
| `search-index.mjs <build> --index-only` (or subcommand `index`) | `writeConfig`, then create and import. Prints the collection name (and writes it to a file such as `<build>/.search-collection`, so the release carries it). Does not touch the alias. | `publish()` steps 1 and 2 |
| `search-index.mjs promote <collection>` | Checks that the collection exists and has documents, then `PUT /aliases/docs`, `ensureSearchKey` and `ensureAnalytics`. | steps 3 and 5 |
| `search-index.mjs prune --keep <n>` | Deletes `docs_\d{14}` collections other than the alias target and the newest n. | step 4, with a keep count |

The default (no flag) can stay as index, promote and prune with `--keep 0`, so local use and the README stay valid. Typesense documents the alias as the zero-downtime reindex mechanism: "Creates/updates an alias" with `PUT /aliases/:alias`, and searches go to the new collection once it is switched (https://typesense.org/docs/30.1/api/collection-alias.html). Whether the switch is atomic is not stated there **[unverified]**.

Notes for the deploy design:

- The indexer needs `generated/manifest.json` (`search-index.mjs:293,298`) and `site/src/lib/search.mjs` (`:23`) next to the build. Run it on the runner, which already has both after `npm run content`. Otherwise the manifest has to be shipped to the VM.
- The admin key must reach Typesense. With Typesense on the VM, either expose the admin port to the runner (a risk: the admin key would cross the network, and the port would need an allow-list or tunnel) or run the import on the VM over SSH against `127.0.0.1`. The import then needs Node and the records on the VM. A middle path is `--dry-run` on the runner (records JSONL), then a plain `curl` import to localhost on the VM. That would need a small importer, because `publish()` reads records from an iterator, not a file **[inference]**.
- Analytics and search-key setup are idempotent and alias-scoped (`:245`, `:262`), so they belong with `promote`.

## 2. When are old collections dropped, and what happens on rollback?

- Order: alias first (`search-index.mjs:230`), then the drop loop (`:231-233`). Readers never see a missing index, but after a successful run exactly one `docs_*` collection exists.
- The drop loop keeps nothing but the new collection. Analytics collections (`search_queries`, `search_nohits`) do not match the pattern and survive (`:255`, `:232`).
- Rollback by repointing a symlink to the previous release:
  - The previous release's collection no longer exists.
  - The alias `docs` still points at the newer collection. The previous release's `search-config.json` names the alias (`:282`), so it queries the newer index.
  - Effect: search results can link to pages or versions that the rolled-back site lacks (404s). Pages that exist only in the old release are not found. Facets such as `version_id` reflect the newer lock file **[inference from the schema at `:29-49` and the filter in `site/src/lib/search.mjs:36-43`]**.
- To keep search in step with a rollback: keep at least the previous collection (`prune --keep 1`). Store the collection name inside each release (for example the `.search-collection` file above). Make rollback = symlink swap + `promote <name from that release>`. Memory cost: one extra index of about 350 MB (`.scratch/wso2-docs-site/issues/17-production-search-engine.md:18`; README `:82`), which the VM must have spare.

## 3. What a deploy must run, from checkout to a full `site/build`

Ground truth is the PR CI (`.github/workflows/docs-site-ci.yml:25-45`). A deploy differs only by dropping `--allow-missing` (README `:70`: "A deploy must assemble without `--allow-missing`, so it waits until every key is stored"; `snapshots.mjs:213-217,230-231`).

| # | Step | Source | Time (measured / estimate) | Disk |
|---|---|---|---|---|
| 1 | `actions/checkout` of the exact commit, `persist-credentials: false`. The tree must be clean: snapshot keys hash git trees at HEAD, and any uncommitted change under the chrome or converter paths adds a `-dirty-<time>` marker, so no key matches (`snapshots.mjs:28-30,116-122`). | ci.yml:25-27 | under 1 min [estimate] | small |
| 2 | `actions/setup-node` with Node **22**. The Node major version is part of every snapshot key (`snapshots.mjs:124-128`), so it must match the snapshots workflow (`docs-site-snapshots.yml:28-29,51-52`). | ci.yml:28-32 | under 1 min [estimate] | small |
| 3 | `npm ci --ignore-scripts` | ci.yml:33 | 1 to 3 min [estimate, npm cache on] | about 1 GB node_modules **[unverified]** |
| 4 | `npm test` (optional for a deploy; the PR already ran it) | ci.yml:34 | unknown | none |
| 5 | `node scripts/fetch-sources.mjs`: Latest of every section only; snapshot versions are skipped unless named (README `:68`) | ci.yml:35 | unknown, network-bound | sources in `.cache/`. Measured per version: Identity Platform fork 1.1 GB (commit `3307f6c` message), 250 to 640 MB of images per IS version, 0.6 to 1.4 GB per APIM/MI branch (`.scratch/wso2-docs-site/research/02-pulling-content-sources.md:124,170`) |
| 6 | `npm run content` (builds the converter, then `build-content.mjs`) | ci.yml:36, package.json:13 | unknown | `generated/` (about as large as the converted sources plus static files) **[unverified]** |
| 7 | `npm run build` with `DOCS_HEAP_MB=12288` (`scripts/docusaurus.mjs:10-15`) | ci.yml:20,37 | README `:22`: full build "15 to 50 minutes depending on free memory". `ci.yml:18`: "the pilot's live build took 47 min on a 16 GB laptop" (before Faster). With Faster: 10,084 pages, peak memory 4.6 GB (commit `e1ebede`), no time recorded | live `site/build` (part of the 11 GB below) |
| 8 | `SNAPSHOT_STORE=github-release:docs-site-snapshots GH_TOKEN=<read token> node scripts/snapshots.mjs assemble site/build site/build`, **without** `--allow-missing`. It throws on the first missing key (`snapshots.mjs:230-231`). Merging in place saves a copy (`:219-222`). | ci.yml:40-43 | unknown: one download plus untar per snapshot, sequential (`:227-252`). About 33 older versions (issue 17 `:18`) | merged output about 11 GB (README `:72`; ci.yml:14-15). One tarball and its extracted copy at a time in tmp. |
| 9 | `node scripts/check-links.mjs site/build --baselines link-baselines` | ci.yml:45 | unknown (walks about 11 GB of HTML) | none |
| 10 | Index (build-only mode from section 1). Writes `site/build/search-config.json`. | proposal; README `:82,92` | about 1 min (README `:82`), "1 to 2 minutes" (issue 17 `:18`), about 134,000 to 135,000 records | records JSONL in tmp (tens of MB) **[estimate]** |
| 11 | Ship `site/build` to the VM (rsync into a new release dir, then symlink swap), then promote the collection | not in repo | about 11 GB first upload; later rsync deltas **[estimate]** | VM needs about 2x 11 GB for current and previous release |

Runner capacity (https://docs.github.com/en/actions/reference/runners/github-hosted-runners): `ubuntu-latest` on a **public** repository has 4 CPU, 16 GB RAM and 14 GB SSD. On a **private** repository it has 2 CPU, 8 GB RAM and 14 GB SSD. (The README says 7 GB for private, at `README.md:72`, and GitHub now lists 8 GB.)

Risks and findings for step planning:

- **Disk.** 11 GB of merged output plus `node_modules`, `.cache/` sources, `generated/`, the Rspack persistent cache and tmp tarballs likely exceeds 14 GB **[inference]**. Options: free runner disk first (remove preinstalled toolchains; how much this frees is **[unverified]**), or delete `.cache/` sources and `generated/docs` after step 7. `assemble` reads only the lock file, git and the store (`snapshots.mjs:145-149,223-224`; `scripts/redirect.mjs:31`). Step 10 still needs `generated/manifest.json`. Measure `df -h` around steps 7 to 9 in the first run.
- **Memory.** The heap is set to 12 GB, but Faster's measured peak is 4.6 GB. A private repository's 8 GB runner might work with `DOCS_HEAP_MB` lowered, but this is untested **[unverified]**. This repository (`tharindulak/wso2-docs-site`) is currently **private**, and Actions is **disabled** on it (`gh api .../actions/permissions` returned `enabled: false`). It has no `docs-site-snapshots` release, so there are no CI timings to quote.
- **No-missing guarantee.** Step 8 succeeds only when the snapshots workflow has stored every key for this exact commit. That is the reason to trigger the deploy from that workflow's completion (section 4).

## 4. `workflow_run` on "docs-site snapshots"

GitHub facts:

- The run payload has `head_sha` (required string), `head_branch`, `event` and `conclusion` (REST "Get a workflow run" schema, https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#get-a-workflow-run). In the triggered workflow this is `github.event.workflow_run.head_sha`.
- For `workflow_run`, `GITHUB_SHA` is "Last commit on default branch" and `GITHUB_REF` is the default branch (https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run). A plain `actions/checkout` would therefore build the wrong commit. Pass `ref: ${{ github.event.workflow_run.head_sha }}`.
- "A workflow run is triggered regardless of the conclusion of the previous workflow." Gate with `github.event.workflow_run.conclusion == 'success'` (same page).
- "This event will only trigger a workflow run if the workflow file exists on the default branch." `branches:` filters on the triggering run's branch. The chain limit is three levels (same page).
- The triggered workflow gets secrets and write tokens even if the triggering one could not, and "Running untrusted code on the `workflow_run` trigger may lead to security vulnerabilities" (same page). Here the triggering workflow runs only on pushes to protected branches and `workflow_dispatch`, not on fork PRs, so the risk is low. Still, keep deploy secrets in a protected `environment` **[recommendation]**.
- "A job that is skipped will report its status as "Success"" (https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/using-conditions-to-control-job-execution).

Repository behaviour with nothing missing (matrix `[]`):

- `plan` runs and outputs `matrix=[]` (`docs-site-snapshots.yml:32-35`).
- `build` has `if: needs.plan.outputs.matrix != '[]'` and is skipped (`:39`).
- `upload` has `if: !cancelled() && needs.plan.result == 'success' && needs.build.result != 'skipped'` and is skipped (`:69`). Its matrix `fromJSON('[]')` is not expanded, because the job-level `if` is false **[inference; GitHub fails a job whose matrix is empty when it does run]**.
- With one successful job and two skipped jobs, the run conclusion is expected to be `success`, which fires `workflow_run` with `conclusion: success` **[inference: GitHub documents the skipped job's status, not the run conclusion; confirm with one `workflow_dispatch` run]**.
- A failed build leg (`fail-fast: false`, `:43`) makes the run `failure`, so the deploy correctly does not run. The upload job still stores the legs that succeeded (`:68-69`).

Issues that stop this from working as-is in this repository:

- **Branch mismatch.** The snapshots workflow triggers on pushes to `main` and `docs-site-versions` (`docs-site-snapshots.yml:6-8`), but the default branch is `docs-site-build` (`gh repo view`). Pushes to `docs-site-build` never run it today. The deploy's `workflow_run` must also live on the default branch.
- **Bot merges.** Content-bump PRs are created and auto-merged with `GITHUB_TOKEN` (`docs-site-content-bump.yml:39-50`). GitHub: "events triggered by the `GITHUB_TOKEN` will not create a new workflow run", except dispatch events; PR `opened`/`synchronize` runs are created in an approval-required state (https://docs.github.com/en/actions/concepts/security/github_token). So the bump PR's CI needs approval. Whether the auto-merge push then triggers the `push`-based snapshots workflow is **[unverified]**: if it does not, content bumps never deploy. Use a GitHub App token for the bump bot, or add a schedule or dispatch to the snapshots workflow.
- **Path filter.** Only pushes touching `docs-site/**` or the workflows run it (`:8`). That is acceptable: other pushes do not change the site.
- **Queued runs.** `concurrency: docs-site-snapshots`, `cancel-in-progress: false` (`:12-14`) serializes runs, and a newer pending run replaces an older pending one. The replaced run concludes `cancelled`, so the `success` filter skips it, and the newer run deploys a later commit **[GitHub concurrency behaviour, unverified here]**. The deploy workflow needs its own concurrency group. Before promoting, it should check that `head_sha` is still the branch head, so that an older run finishing late cannot overwrite a newer deploy **[recommendation]**.

## 5. Setting `site.url` from an environment variable

Today: `url: 'https://wso2.com'`, `baseUrl: '/'`, `trailingSlash: true` (`docs-site/site/docusaurus.config.js:85-87`).

Change needed (proposal): read `process.env.DOCS_SITE_URL` with the current value as the default. Validate it as `https://` (or `http://localhost`) with no path, query or trailing slash, and fail the build otherwise. The site is served at `/`, so `baseUrl` stays `/`.

What derives from `siteConfig.url` (Docusaurus 3.10.2, as installed in the main checkout's `node_modules`):

- `<link rel="canonical">` and `<meta property="og:url">` on every page: `siteUrl + canonicalPathname` (`@docusaurus/theme-classic/lib/theme/SiteMetadata/index.js:74-100`).
- Every `<loc>` in `sitemap.xml`: `normalizeUrl([siteConfig.url, route.path])` (`@docusaurus/plugin-sitemap/lib/createSitemapItem.js:43-50`). Hidden products and `account` are excluded (`docusaurus.config.js:124`).
- The search-outage fallback link `site:<host>` on DuckDuckGo: `webSearchHref(query, siteConfig.url)` (`site/src/lib/search.mjs:126-128`, used from `site/src/components/search/SearchDialog.js:56` and `site/src/pages/search.js:63`).

What does **not** derive from it:

- Search records store root-relative URLs (`pagePath`, `search-index.mjs:58`; `url` built at `:132`). A host change needs no re-index.
- `search-config.json` holds `TYPESENSE_PUBLIC_URL`, not the site URL (`search-index.mjs:281-283,312`).
- Redirect pages from the converter and `scripts/redirect.mjs` write their own canonical to the target (`site/src/components/Redirect.js:10`, `scripts/redirect.mjs:9`).
- Server-side settings that use the site origin live outside the build: Typesense CORS (`TYPESENSE_CORS_DOMAINS`) and the site's CSP `connect-src` (README `:99`).

Snapshot interaction (important):

- `site/docusaurus.config.js` is part of the snapshot key's chrome hash, but as a git tree hash (`snapshots.mjs:28,116-121`), so an env value is **not** in the key. The config comment says snapshots "must not depend on the environment" (`docusaurus.config.js:118-119`).
- Snapshot pages render canonical and `og:url` like any page, from whatever URL the snapshots workflow had. If deploy and snapshot builds use different values (for example a staging host), the stored snapshots keep the other host's canonical links.
- Options: (a) set the same `DOCS_SITE_URL` in `docs-site-snapshots.yml` (simple, but a URL change will not rebuild snapshots); (b) add the URL to `inputHashes()` so a change rebuilds every snapshot; (c) keep the URL in the committed config (a change then rebuilds through the tree hash). Option (b) or (c) keeps the "function of its key" rule.
- `sitemap.xml` comes from the live build only. Snapshot tarballs contain `.snapshot-key`, the version route and `assets/`, but no sitemap (`snapshots.mjs:204`), so the merged sitemap lists Latest pages only. That may be intended (older versions not in search engines), but nothing in the repo states it **[finding]**.

## Sources

- Repo: `docs-site/scripts/search-index.mjs`, `snapshots.mjs`, `snapshot-store.mjs`, `docusaurus.mjs`, `redirect.mjs`; `docs-site/site/docusaurus.config.js`; `docs-site/site/src/lib/search.mjs`; `docs-site/README.md`; `docs-site/package.json`; `.github/workflows/docs-site-{ci,snapshots,content-bump,version-promotion}.yml`; `.scratch/wso2-docs-site/issues/17-production-search-engine.md`; `.scratch/wso2-docs-site/research/02-pulling-content-sources.md`; commit messages `e1ebede`, `3ab6fec`.
- Docusaurus 3.10.2 source in `/Users/admin/Documents/wso2/Wso2-Cloud/docs-site/node_modules/@docusaurus/` (theme-classic, plugin-sitemap).
- GitHub: events that trigger workflows (workflow_run), REST workflow runs, job conditions, GITHUB_TOKEN, hosted runner specs (URLs inline above). Fetched 2026-10-19.
- Typesense collection alias: https://typesense.org/docs/30.1/api/collection-alias.html.
- `gh repo view` / `gh api repos/tharindulak/wso2-docs-site/actions/permissions` / `gh release list` on 2026-10-19: private, default branch `docs-site-build`, Actions disabled, no releases.
