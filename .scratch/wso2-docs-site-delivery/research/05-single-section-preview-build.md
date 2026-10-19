# 05 Building one section at a chosen ref (researched 2026-10-19)

Ticket: "Building one section at a chosen ref", for the Preview workflow (manual dispatch with a section id from `docs-site/content-sources.yaml` and a content-source ref that overrides that section's pin for one run; builds that section's Latest only; publishes to a separate preview hostname on a VM; search off; kept 14 days).

Sources: this repo at `c38fbf0` (branch `docs-site-build`), a throwaway local experiment (cleaned up afterwards), `git ls-remote` / `git fetch` / `gh api` against public GitHub repos, GitHub and Docusaurus documentation. **[inference]** marks my reasoning; **[unverified]** marks claims not checked against a primary source or a measurement.

## Short answers

1. **Yes, the path exists.** `node scripts/fetch-sources.mjs <id>` → `node scripts/build-content.mjs <id>` → `node scripts/build-sections.mjs build <id>` (`npm run build:quick -- <id>`) fetches, converts and builds one section's Latest into `docs-site/site/build-quick` via `DOCS_SECTIONS`. Verified end to end locally. Changes needed for a preview are small: a script that writes a temporary lock copy with the overridden SHA, a configurable `url` plus `noIndex` in `docusaurus.config.js`, and a link-check mode for previews (see 3).
2. **Use `DOCS_SITE_LOCK`** (already honoured by every script through `scripts/lib.mjs:11`). Resolve the input ref to a 40-character SHA against the lock's own repo first (`git ls-remote`, as `bump-sources.mjs` does), write a copy of the lock with only that section's Latest `sha` replaced into `$RUNNER_TEMP`, and point `DOCS_SITE_LOCK` at it. Verified: overriding `healthcare` to the head of `main` fetched, converted and built without touching the committed lock.
3. **Chrome:** the home page, `/search/`, `/account/` and 404 page are always built; the Products menu and product bar list every product (client-side catalogue), and footer and home-page links to other sections are broken. Docusaurus does not fail (`onBrokenLinks: 'warn'`, `docusaurus.config.js:88`), but `check-links.mjs` exits 1 on them. Use `check-links.mjs --under <route>` plus a filter for other sections' routes, or skip the gate. **Host:** serve each preview at the root of its own hostname: keep `baseUrl: '/'` (generated redirects, `versions.json` and content links are root-relative, so a path prefix would break them) and set `url` to the preview origin, with `noIndex: true`.
4. **Measured on a 10-core, 16 GB Mac (Docusaurus Faster on):** Accelerator for Healthcare (103 pages): fetch 7 s, convert 1 s, build 9 s, 1.4 GB peak RSS, 81 MB output. API Manager Latest (794 pages plus its Bijira cloud companion): fetch 32 s (APIM checkout already cached), convert 11 s, build 36 s (Rspack cache partly warm), 3.3 GB peak RSS, 914 MB output, 892 pages. CI runner times are **[unverified]**: expect several times slower (4 vCPU, cold caches, cold fetch of the 2.5 GB APIM checkout).
5. **Security:** the ref is untrusted. Pass it only through `env:`, never `${{ inputs.ref }}` inside `run:` (GitHub's script-injection guidance). Allow-list the format, take the repo only from the lock, and resolve to a SHA that is a branch or tag **of that repo**. **Verified risk:** GitHub serves fork-only commits through the upstream URL (`git fetch https://github.com/wso2/docs-apim.git <sha of a commit on tharindulak/docs-apim only>` succeeded), so a raw SHA input could pull fork content; the existing `head !== sha` check in `fetch-sources.mjs:58-59` does not catch it. Accept branch and tag names, or a SHA only after a reachability check from the repo's own refs. Build with read-only permissions and no secrets; the publish step runs in a separate job.

Blocking finding for CI: with `CI` set, `readLock()` rejects the committed lock today because 17 sources pin `tharindulak/*` forks (`lib.mjs:14-15`; `CI=1` run fails with `integration-mi: repo must be wso2/<name>, got tharindulak/docs-mi`). A preview workflow, like `docs-site-ci.yml`, cannot run until the lock pins only `wso2/*` repos.

## 1. Existing single-section path

| Step | Command | What it honours | Evidence |
|---|---|---|---|
| Fetch | `node scripts/fetch-sources.mjs <sectionId>` | Positional section or version ids; snapshot versions skipped unless named by version id; cloud companions of the section come too | `fetch-sources.mjs:2,10,26-39` |
| Convert | `node scripts/build-content.mjs <sectionId>` | Only the named section is converted (`only`), but the manifest, `versions.json` per section and the hosted-link rewrite still cover every section in the lock | `build-content.mjs:28,291-354,357-376` |
| Build | `node scripts/build-sections.mjs build <sectionId>` (`npm run build:quick -- <id>`) | Sets `DOCS_SECTIONS`, the 12 GB heap (`withHeap`), output `site/build-quick` | `build-sections.mjs:35-36`; `docusaurus.mjs:10-15`; `package.json` `build:quick` |
| Site config | `DOCS_SECTIONS=id,...` → one docs plugin per included version | Unknown ids fail; snapshots excluded | `docusaurus.config.js:21-33` |

Observations from the run:

- Only Latest is built: `live_window: 1` (`content-sources.yaml:29`) and the config excludes snapshot versions (`docusaurus.config.js:33`). This matches the decided scope without changes.
- `generated/static` is added whole to `staticDirectories` (`docusaurus.config.js:120`). On a fresh CI checkout it holds only the previewed section's static files plus a `versions.json` per section, so that is fine; on a reused workspace, stale static folders of other sections would ship in the preview (seen locally: `healthcare/` from an earlier run appeared in the APIM preview). **Run previews in a clean workspace.**
- `build-content.mjs` exits 1 when a page fails that is not on the exclude list (`build-content.mjs:319-321,406-409`). For a preview of a work-in-progress branch that may be too strict **[inference]**: decide whether the preview should still build (for example a `--preview` flag that reports and redirects new failures instead of failing). Not decided here.
- Quick and full builds share `site/.docusaurus` (README:30); irrelevant in a dedicated CI job.

Minimal changes for the preview workflow **[inference]**:

1. `scripts/preview-lock.mjs <sectionId> <sha> <out>` (new): load the lock with the same validation (`readLock`), set the SHA on the section's Latest source, write the copy, and re-run `readLock` on it. Structured edit, not `sed`: shared SHAs are common (API Manager 4.7.0 and 4.6.0 both pin `3ffee4c…`, `content-sources.yaml:486-496`), and a text replace would move other entries too. Where to put the SHA:
   - legacy section (no `versions:`): `section.sha` (`versions.mjs:42-44`);
   - listed versions: `versions[0].sha` (Latest, `versions.mjs:46-54`); leave `ref` unchanged, since `validateVersions` rejects a `ref` that looks like another version's release tag (`versions.mjs:106-107`);
   - `mkdocs-merge`: two sources (`cloud.sha` and `self_hosted.versions[0].sha`); sections with `cloud_companion` also have two (`lib.mjs:55-59`). The dispatch needs a `source` choice (`primary` / `cloud`) or the preview only overrides the primary source. **Open decision.**
2. `docusaurus.config.js`: read the site origin from an env var (for example `DOCS_SITE_URL`, validated as `https://` with no path) instead of the fixed `url: 'https://wso2.com'` (`docusaurus.config.js:85`), and `noIndex: true` when a preview flag is set. Docusaurus: `noIndex` "adds `<meta name="robots" content="noindex, nofollow">` to every page" ([docusaurus-config](https://docusaurus.io/docs/api/docusaurus-config#noIndex)). Note this file is in every snapshot key (README:64), so the change rebuilds all snapshots once.
3. A link-check mode for previews (see 3).

## 2. Overriding the pin for one run

- `LOCK` is `process.env.DOCS_SITE_LOCK` when set (`lib.mjs:11`); `fetch-sources.mjs`, `build-content.mjs` (including its exclude-list rewrite, `build-content.mjs:393-404`, which then touches only the copy) and `bump-sources.mjs` all read it. The site config does not read the lock (it reads `generated/manifest.json`, `docusaurus.config.js:13-16`), so nothing else needs the copy.
- Resolve first, then pin. `fetch-sources.mjs` fetches only by SHA (`fetch-sources.mjs:56`) and `readLock` requires 40 hex characters (`lib.mjs:16,29`), so a branch or tag must become a SHA before the lock copy is written. Existing resolution code to reuse: `headOf` (`git ls-remote https://github.com/<repo>.git refs/heads/<branch>`, `bump-sources.mjs:20-25`) and `tagSha` (annotated tags peeled with `^{}`, `bump-sources.mjs:38-46`). Both use `execFileSync` with an argument array (no shell) and a 60 s timeout.
- Experiment (2026-10-19): `git ls-remote https://github.com/wso2/open-healthcare-docs.git refs/heads/main` gave `41e321a3…` (lock pin: `e2512a02…`, `content-sources.yaml:702`). A lock copy with that one SHA changed, passed through `DOCS_SITE_LOCK`, fetched `wso2/open-healthcare-docs@41e321a39fd0`, converted 103 pages with 0 new failures and built. `git status` stayed clean.
- Record the resolved SHA in the preview's page or job summary so the reviewer knows which commit they see **[inference]**.

## 3. Site chrome, links and host

What a one-section build contains (from `site/build-quick` of the healthcare run):

- Home page (`site/src/pages/index.js`), `/search/`, the Account and billing hub (`/account/`, always built, `docusaurus.config.js:127`), 404, and the section. 106 `index.html` files for a 103-page section.
- Navigation catalogue: built from the whole manifest (`docusaurus.config.js:71-80`), so the Products menu and product bar list every product. Those are client-rendered from `customFields`, so the HTML link check does not see them; in the preview they lead to 404s. The README already says this for quick builds (README:30, `docusaurus.config.js:19-20`).
- Broken links found by `check-links.mjs site/build-quick`: healthcare 438, of which 428 are chrome (footer links to `/agent-manager/`, `/identity/`, `/api-platform/`, `/integration/` on every page, `docusaurus.config.js:144-150`; home-page cards to other sections) and 5 are content links at the new commit. API Manager: 893 per footer target, plus 532 content links under `/api-platform/api-manager` (the pilot measured API Manager as the largest source of live broken links, 525; `10-pilot-measurements.md` line 58).
- The Docusaurus build passes with warnings (`onBrokenLinks: 'warn'`, `docusaurus.config.js:88`). `check-links.mjs` without baselines exits 1 (`echo $?` = 1); `--under <prefix>` limits pages, not targets (`check-links.mjs:47-50`), so footer links still count. Options **[inference]**: (a) no gate, report only; (b) gate on targets under the section's route (`findBrokenLinks` results filtered by target prefix), comparing to `link-baselines/live.json` entries for that section. (b) tells the author whether their branch adds breakage.
- Search: no `search-config.json` in CI (it comes from `.cache/search-public`, `docusaurus.config.js:121`), so the dialog says "Search is unavailable right now" on a non-local host and offers a web search scoped to `siteConfig.url` (`SearchUnavailable.js:7-12,23`). With `url` set to the preview host, that web search would point at a host search engines do not index; leave `url` for web search as production or hide the link in previews **[inference]**.

Host and `baseUrl`:

- Keep `baseUrl: '/'`. Root-relative paths are written outside Docusaurus's control: section-root redirects `/${route}/${landing}` (`build-content.mjs:373`), `versions.json` paths (`build-content.mjs:361`), `pages.json`, former-route redirects, and converted content links such as `/healthcare/...`. Docusaurus rewrites its own links for `baseUrl` but not static HTML or JSON in `generated/static` **[inference, from the code paths above]**. So a preview must sit at the root of its own origin: one hostname per preview (for example `<run-id>.<preview-domain>`, wildcard DNS and TLS on the VM) or one port per preview. A single host with `/<preview-id>/` prefixes would need a `baseUrl`-aware rewrite of all of those.
- Set `url` to that origin (Docusaurus: `url` is the "top-level hostname", [docusaurus-config](https://docusaurus.io/docs/api/docusaurus-config#url)); it feeds canonical and Open Graph URLs and `sitemap.xml`. Add `noIndex: true` and an `X-Robots-Tag: noindex` header on the VM **[inference]**.

## 4. Time and size

Local, 2026-10-19, macOS, 10 cores, 16 GB RAM, Node 22.23.2, `npm ci --ignore-scripts` (9 s) and `npm run build:converter` first. `/usr/bin/time -l`; RSS of the build includes the Docusaurus child.

| Section | Pages (converted / `index.html`) | Fetch | Convert | Build | Build peak RSS | Output |
|---|---|---|---|---|---|---|
| `healthcare` at `main` head (override) | 103 / 106 | 7.2 s (94 MB checkout) | 1.2 s | 9.1 s (cold Rspack cache) | 1.4 GB | 81 MB (`assets/` 24 MB) |
| `api-platform-apim` at its pin | 794 / 892 | 32 s (APIM 2.5 GB checkout copied from another worktree, so only the 552 MB Bijira companion was fetched) | 10.8 s | 36 s (Rspack cache warm from the first run; shared dependencies only) | 3.3 GB | 914 MB (`assets/` 515 MB); `generated/` 1.0 GB |

Comparable repo figures: per-version snapshot builds (one version each, 563 to 851 pages) took 92 to 255 s at 3.7 to 6.7 GB RSS on a swapping 16 GB machine (`.scratch/wso2-docs-site-versions/research/10-pilot-measurements.md`, lines 125-137); the full fetch took 1,142 s (line 89). The README's "about 10 minutes for Integration Platform" quick build (README:22) predates Docusaurus Faster.

Estimates for a GitHub-hosted runner **[unverified]**: small section, under 5 minutes including `npm ci` and fetch; API Manager, about 10 to 20 minutes, dominated by the cold fetch of a 2.5 GB sparse checkout and a cold Rspack build. Heap: the 12 GB default in `docusaurus.mjs:12` is far above the 3.3 GB measured; `DOCS_HEAP_MB=6144` should suffice for one section **[unverified]**, which matters on 7 GB private-repo runners (README:72). Disk: under 5 GB for API Manager (checkouts, `generated/`, output). Measure on the real runner before setting `timeout-minutes`.

## 5. Security

Threat: anyone who can dispatch the workflow (write access) chooses a ref; the content at that ref is untrusted (it is rendered as MDX, which can contain JSX). The section id is less risky but still input.

Checks, in order:

1. **Inputs only through `env:`.** GitHub: "For inline scripts, the preferred approach to handling untrusted input is to set the value of the expression to an intermediate environment variable" ([Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use); background: [Script injections](https://docs.github.com/en/actions/concepts/security/script-injections), expressions are substituted before the script runs). The repo already does this for matrix values (`docs-site-snapshots.yml`: `SNAPSHOT_ID: ${{ matrix.snapshot.id }}` then `"$SNAPSHOT_ID"`).
2. **Section id:** `type: choice` input listing the lock's ids, and re-check in the script against `^[a-z0-9][a-z0-9-]*$` (`lib.mjs:25`) and membership in the lock. Do not rely on `choice` alone: the workflow-syntax page does not say whether API dispatch validates choice values ([workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)) **[unverified either way]**.
3. **Ref format allow-list**, stricter than the lock's `BRANCH`/`TAG` (`lib.mjs:17`, `bump-sources.mjs:36`), for example `^(?!-)(?!.*\.\.)(?!.*//)(?!.*@\{)(?!.*\.lock$)(?!.*/$)[A-Za-z0-9._/-]{1,200}$`, or a 40-hex SHA. No leading `-` (option injection into git), no `..`, no whitespace or shell metacharacters. Optionally also `git check-ref-format --branch` ([git-check-ref-format](https://git-scm.com/docs/git-check-ref-format)).
4. **Repo from the lock only.** The repo is never an input; it comes from the section's entry, which `readLock` checks against `wso2/<name>` in CI (`lib.mjs:13-15,28`). `DOCS_SITE_TEST_OWNER` is ignored when `CI` is set (`lib.mjs:14`); keep it that way.
5. **Resolve to a SHA on that repo's own refs.** Use `git ls-remote https://github.com/<repo>.git refs/heads/<ref> refs/tags/<ref> refs/tags/<ref>^{}` (argument array, `execFileSync`, as `bump-sources.mjs:21,41`); fail if nothing or more than one ref matches. `ls-remote` lists only that repository's refs: `wso2/docs-apim` has no `docusaurus-migration` branch while `tharindulak/docs-apim` does (checked 2026-10-19).
6. **Do not trust a raw SHA.** Verified 2026-10-19: commit `3ffee4c555beaa647da2393c8d1148bb7d65ec4e` exists only on the fork `tharindulak/docs-apim` (a fork of `wso2/docs-apim`), yet `gh api repos/wso2/docs-apim/commits/3ffee4c…` returned it and `git fetch --depth 1 --filter=blob:none https://github.com/wso2/docs-apim.git 3ffee4c…` succeeded. Fork networks share objects, so anyone with a fork can make a SHA fetchable "from" the wso2 repo. `fetch-sources.mjs` only checks that HEAD equals the requested SHA (`:58-59`). Either accept branch and tag names only, or accept a SHA only after proving it is reachable from a branch or tag of the lock repo (for example a treeless fetch `git fetch --filter=tree:0 origin 'refs/heads/*:refs/remotes/origin/*'` then `git branch -r --contains <sha>`) **[inference; the containment check itself not tested]**. The same applies to committed pins, but those go through review.
7. **Least privilege.** Build job: `permissions: contents: read`, `persist-credentials: false`, no secrets, no `GH_TOKEN` (as `docs-site-ci.yml:7-8,26-27`). Publish job: receives only the built artifact (as the snapshot upload job does, README:74), holds the VM deploy credential, runs no repository scripts, and writes to a path derived from the run id, never from the ref. A `environment:` with required reviewers is optional.
8. **What the content can do at build time.** Converted MDX is compiled and server-rendered in the build job, so a hostile branch can run code there **[inference]**; the HTML allow-list in the converter limits raw HTML but not JSX semantics fully (README:38,103). Hence no secrets in the build job, and the preview host should be a separate origin with no cookies shared with `wso2.com`.

## Open decisions for the map

- Which source a ref overrides for sections with two (`mkdocs-merge`, `cloud_companion`).
- Whether a preview builds when pages fail conversion that are not on the exclude list.
- Link gate for previews: none, or "no new breakage under the section's route".
- Branch/tag only, or SHAs with a reachability check.
- The fork pins in the committed lock block any CI run (preview included) until replaced by `wso2/*` repos.
