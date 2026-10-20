# Map: Deploying, previewing and migrating the docs site with GitHub workflows

Label: wayfinder:map

## Destination

A build-ready spec, handed off for implementation, for three GitHub workflows: **Deploy** (build the docs site from the lock file and publish it, with search, to a VM), **Preview** (build one section at a chosen content-source ref and publish it to a preview host) and **Migration** (convert a content source to Docusaurus and keep one standing PR open on its repo). Done when every workflow's spec leaves nothing to decide.

## Notes

- Domain: documentation platform delivery. Vocabulary lives in [CONTEXT.md](../../CONTEXT.md) (Docs site, Content source, Product). Builds on the [WSO2 docs site on Docusaurus](../wso2-docs-site/map.md) map and `docs-site/README.md`.
- Planning only: tickets produce decisions, not workflows. Building them is handed off.
- Skills every session should consult: grilling, domain-modeling. Research tickets use research.
- Already in place (do not re-decide): `docs-site-ci.yml` (PR build), `docs-site-snapshots.yml`, `docs-site-content-bump.yml`, `docs-site-version-promotion.yml`, `scripts/migrate-docusaurus.mjs`, `scripts/search-index.mjs`, `search/compose.yaml`. The merged build is about 9.8 GB and needs about 12 GB of heap.
- Charting decisions (user, 2026-10-19):
  - **Versions come from the lock.** A deploy publishes what `content-sources.yaml` pins at a commit of this repo; versions change only through the existing bump and promotion PRs. Ad hoc refs are for Preview only.
  - **Deploy triggers:** after `docs-site snapshots` succeeds on the default branch (`workflow_run`, guarded), manual dispatch, and a daily backstop (see [Bot identity and gates for lock changes](issues/13-bot-identity-and-gates-for-lock-changes.md)). Assembles without `--allow-missing`.
  - **One VM for now**, run by the user (others may get access later). Caddy serves it with automatic HTTPS on an sslip.io hostname (replaces nginx, 2026-10-20; see [VM facts and deploy access](issues/01-vm-facts-and-deploy-access.md)); GitHub-hosted runners reach it over SSH.
  - **Releases:** rsync into a timestamped release folder with `--link-dest`, switch a `current` symlink, keep the last 3; rollback repoints the symlink.
  - **Caddy config** versioned in this repo, applied by hand. The deploy user has no sudo.
  - **SSH:** dedicated `deploy` user owning only the releases folder; key restricted in `authorized_keys` (`restrict` plus an rrsync forced command); host key pinned; key, host and known_hosts as secrets on a GitHub environment limited to main: `test` in this fork, `production` only in the org repo (see [CI and a lock pinned to forks](issues/12-ci-and-a-lock-pinned-to-forks.md)).
  - **Search is in scope:** Typesense in Docker on the same VM behind Caddy https. Deploy order: rsync, build new collection, switch symlink, move the `docs` alias. Index failure stops the deploy before the switch. The admin key never leaves the VM (see [Deploy workflow spec](issues/07-deploy-workflow-spec.md)).
  - **Preview:** manual dispatch with a section id and a content-source ref overriding that section's pin for the run; builds that section's Latest only; preview hostnames as subdomains of the VM's sslip.io name, one folder per preview, search turned off, removed after 14 days.
  - **Migration:** manual dispatch only, input a section id from the lock. A read-only job runs `migrate-docusaurus.mjs`; a separate job with a GitHub App token (`contents:write`, `pull_requests:write` on `wso2/docs-*`) force-pushes `docs-site/migration` and opens or updates one standing PR against the section's `edit` branch (else `track`), writing to the section's `migration.path` (see [Migration workflow spec](issues/10-migration-workflow-spec.md)). Repeatable until cutover.
  - **Home:** built and tested in this fork (`tharindulak/wso2-docs-site`) against a scratch VM and fork content repos, then moved to a public wso2-org repo (public keeps the 16 GB hosted runner; a private repo would need a paid larger runner).
- Treat findings as planning input for human review; flag security, licensing and cost concerns.

## Decisions so far

<!-- one line per closed ticket -->

- [VM facts and deploy access](issues/01-vm-facts-and-deploy-access.md): test VM is an OCI Arm instance (4 OCPU, 23 GiB) with Caddy; restricted `deploy` user and rrsync-only key checked; root SSH off; `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS` on the `test` environment; deploys must set file modes.
- [Deploy workflow spec](issues/07-deploy-workflow-spec.md): Plan / Build / Promote with an upload-only key in the content-code job and a gate key elsewhere; Typesense admin key stays on the VM, the gate imports records shipped in the release; releases `<timestamp>-<sha>` with `.release.json` and a completion marker; no-op skip, dispatch rollback, keep 3; `test` may deploy Latest only until snapshots are stored.
- [Typesense GPL-3.0 OSS policy check](issues/02-typesense-oss-policy-check.md): cleared; Typesense may be used.
- [Hosting config for Caddy and Typesense](issues/08-hosting-config-caddy-and-typesense.md): web server left to the user's test setup; Typesense in Docker on localhost with keys only on the VM; `docs-site/hosting/` with the compose file, gate and an idempotent `setup.sh` the agent runs after review.
- [Preview workflow spec](issues/09-preview-workflow-spec.md): dispatch with section, ref, optional source and name, create or delete; same Build / Promote split with preview-only keys; atomic per-name switch, 14-day daily cleanup, at most 10 previews and 10 GB free; section links reported, not failed; results in the run summary.
- [Search index and deploy path in the existing scripts](issues/03-search-index-and-deploy-path.md): indexer must split into index / promote / prune (about 40 lines) and keep the previous collection for rollback; deploy checks out `workflow_run.head_sha`; runner disk (about 11 GB output on about 14 GB) is the main risk; `site.url` from a validated env var that snapshots must share.
- [GitHub App for PRs on content repos](issues/06-github-app-for-content-repo-prs.md): org-owned App token (contents and PRs write, one repo, one job); tree passed as a checked tarball to a job that never runs content code; draft PR; signed-commit rules and rulesets on content repos may need API commits or a bypass; an org owner must install it.
- [Building one section at a chosen ref](issues/05-single-section-preview-build.md): one-section builds already exist; override the pin through a temp lock in `DOCS_SITE_LOCK`; chrome links break, so the preview link gate covers the section's route only; one hostname per preview with `baseUrl: '/'`; fork-only SHAs are served through wso2 URLs, so refs resolve against the lock's repo with a reachability check.
- [Release folders, rsync and restricted SSH on the VM](issues/04-release-pattern-on-the-vm.md): atomic `mv -T` symlink switch, no nginx reload, `open_file_cache` off; rrsync only for uploads (root-anchored `--link-dest`), a root-owned gate script for switch, prune, rollback and preview cleanup; `from=` impractical; host key from the console; a `workflow_run` deploy must check `head_branch`/`event`/`head_repository` because environment branch rules see the default branch.
- [How bot changes reach CI, snapshots and deploy](issues/11-how-bot-changes-reach-ci-and-deploy.md): with `GITHUB_TOKEN`, bump CI needs manual approval and auto-merged bumps never start snapshots or Deploy; the snapshots trigger names branches that do not exist; the fork has Actions, auto-merge and bot PR creation off; an App token is the documented fix.
- [CI and a lock pinned to forks](issues/12-ci-and-a-lock-pinned-to-forks.md): forks stand in for wso2 repos until cutover; CI honours fork owners from a repo variable, never when the repo owner is `wso2`; the VM is a `test` environment with `noindex`; every pinned SHA must be reachable from the lock's branch on the lock's repo.
- [Bot identity and gates for lock changes](issues/13-bot-identity-and-gates-for-lock-changes.md): a separate single-repo docs-site bot App; bumps and fix releases deploy with no person in the loop; a required bump-shape check holds any structural lock change until the section's `owners:` team approves; Deploy runs on guarded `workflow_run`, dispatch and a daily backstop.
- [Migration workflow spec](issues/10-migration-workflow-spec.md): section keeps its MkDocs source with a `migration: { path }` block until a reviewed cutover lock PR; read-only convert job, checked tarball, App push job; draft PR on Latest's track branch, force-pushed with `git push`, never over human commits; test App on the user's forks.

## Not yet specified

<!-- empty: the destination is reached (2026-10-20) -->

## Out of scope

- More environments (staging alongside production): how environments, secrets and hostnames multiply once there is more than one VM. Out of scope: beyond the three specs; seed for a follow-up effort such as "Taking the docs site workflows to production" (user decision 2026-10-20).
- Giving others access to the VM and to the `production` environment (reviewers, key rotation, who can dispatch). Out of scope: beyond the three specs; seed for a follow-up effort such as "Taking the docs site workflows to production" (user decision 2026-10-20).
- Previews started from content-repo PRs, so writers see their change without asking someone here. Out of scope: beyond the three specs; seed for a follow-up effort such as "Taking the docs site workflows to production" (user decision 2026-10-20).
- Moving the workflows to the wso2-org repo: repo name, App installation, secrets handover, branch protection, re-pinning the lock from forks to `wso2/*`, creating the `production` environment, installing the docs-site bot App, and giving each section's `owners:` team read access. Out of scope: beyond the three specs; seed for a follow-up effort such as "Taking the docs site workflows to production" (user decision 2026-10-20).
- Sitemap: the merged `sitemap.xml` lists live pages only, not snapshot versions; whether that is intended is undecided. Out of scope: beyond the three specs; seed for a follow-up effort such as "Taking the docs site workflows to production" (user decision 2026-10-20).
- Web server config, test and production (the test VM's Caddy is temporary; the user decides later). Deploy and Preview expect: site from `/srv/docs/current`; preview `<name>` from `/srv/docs/previews/<name>/current`; dot files and `_search/` not published; a search hostname exposing only Typesense's `GET /collections/docs/documents/search`; `noindex` on the test VM; security headers, caching and CSP open. Out of scope: beyond the three specs; seed for a follow-up effort such as "Taking the docs site workflows to production" (user decision 2026-10-20).
- Deploy monitoring and alerts: who hears about a failed deploy or a stale site, and how. Out of scope: beyond the three specs; seed for a follow-up effort such as "Taking the docs site workflows to production" (user decision 2026-10-20).
- Fixing existing workflow defects found on the way (snapshots branch filter, promotion loop with more than one pending promotion, missing CODEOWNERS): separate fixes, not part of this spec; see [How bot changes reach CI, snapshots and deploy](issues/11-how-bot-changes-reach-ci-and-deploy.md).
- Building the workflows themselves: this map ends at the spec (user decision 2026-10-19, charting Q1).
- Rerunning the migration automatically after a bump: migration is manual dispatch only (user decision 2026-10-19).
