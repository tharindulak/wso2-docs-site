# 06 GitHub App for PRs on content repos (researched 2026-10-19)

Ticket: "GitHub App for PRs on content repos". Context: the Migration workflow (manual dispatch, section id from
`docs-site/content-sources.yaml`) runs `docs-site/scripts/migrate-docusaurus.mjs` in a read-only job; a second job
holding a GitHub App token force-pushes `docs-site/migration` on the content repo and opens or updates one PR against
the section's `edit` branch (else `track`), writing into a per-section `migrate_to:` path.

Sources: GitHub Docs and the `actions/*` READMEs (fetched 2026-10-19), and this repo's code. **[inference]** marks my
reasoning, **[unverified]** marks claims not confirmed against a primary source in this pass.

## Short answers

1. **Token.** In the token job, `actions/create-github-app-token@v3` with `client-id`, `private-key`, `owner: wso2`,
   `repositories: docs-is` (one repo per run) and `permission-contents: write`, `permission-pull-requests: write`.
   The token lasts 1 hour and is revoked in the action's post step, so it cannot be handed to another job. App
   permissions: Contents read/write, Pull requests read/write, Metadata read (always on). Workflows permission is
   **not** needed while the push changes no file under `.github/workflows/`; the migration tree never writes there
   (question 6). One open risk **[unverified]**: if a force-push carries edit-branch commits that touched workflow
   files, GitHub might reject it. Building each run on the current edit-branch tip, or creating the commit through
   the API, avoids that case.
2. **Fine-grained PAT.** Acceptable only as a temporary fallback. It belongs to one person, acts with that person's
   access, and lapses when they leave or lose access **[inference]**. It expires: the org default maximum is 366 days,
   and the token default is 30 days. In WSO2's org the token stays "pending" (public read only) until an org owner
   approves it, unless the approval policy is off. GitHub says to use a GitHub App for org resources and automation.
3. **Keep the token away from conversion.** Follow `docs-site-snapshots.yml`: convert in a `contents: read` job, send
   one tarball plus a SHA-256 through an artifact, and in the token job run no checkout of docs-site, no `npm` and
   no repo script. Before committing, validate: exactly the expected file name, not a symlink, the checksum, tar
   entries all relative and inside `migrate_to`, no symlinks or hard links, nothing under `.github/`, and
   `migrate_to` matched against an allow-list regex. Pack a tarball rather than uploading the folder:
   `upload-artifact` skips hidden files by default, and that would drop the tree's `.wso2-docs-tree` marker.
4. **Force-pushing an open PR.** If "dismiss stale approvals" is on (branch protection or a ruleset on the base
   branch), any push that changes the diff dismisses approvals. Review threads on changed lines show as outdated
   **[unverified mechanics]**. CODEOWNERS reviewers come from the base branch's CODEOWNERS and are requested when a
   PR opens or a draft is marked ready; the docs do not say re-pushes request them again. The base branch's rules
   do not block pushes to `docs-site/migration` itself; rulesets that target that name (restrict creations or
   updates, block force pushes) would, unless the App is a bypass actor. If the base branch requires signed commits,
   commits pushed with plain `git push` are unsigned and can block even a squash merge. Commits made through the API
   as the App are signed by GitHub.
5. **Who sets it up.** An org owner, or a GitHub App manager for all of the org's apps, can register the App. Only
   an org owner can install it on the org; the App manager role grants no install rights. A repo admin can install
   it on repos they administer, if the App asks for no org permissions or Administration and owners have not
   switched that off. Install with "Only select repositories" and pick the `wso2/docs-*` content repos. Register it
   as private ("Only on this account") under `wso2`.
6. **What the script produces.** It produces a tree at `<outDir>`: `.wso2-docs-tree` marker, `docs/`,
   `versioned_docs/version-X/`, `sidebars.json`, `versioned_sidebars/`, `versions.json`, optional `redirects.json`,
   `assets/` and `static/` (with `_versions/<v>/` for files that differ between versions). Outside the tree, in
   `docs-site/generated/`, it writes `tree-review.txt` (nested `<Steps>` to check, `file:line`) and
   `content-report.json` (per-version counts, failures, dropped nav, front-matter problems). The PR body should carry
   both, plus the pinned SHAs. Nothing lands at the tree root's `.github/`; only a bad `migrate_to` value could put
   files there.

## 1. Installation token for another repo

**How (verified).** `actions/create-github-app-token` README
(<https://github.com/actions/create-github-app-token>, latest major `v3`):
- Inputs: `client-id` (recommended; `app-id` accepted), `private-key`, `owner`, `repositories` (comma or newline
  list; entries may be `owner/repo`, owner must match `owner`), `permission-<name>` and `skip-token-revoke`.
- `owner` set and `repositories` empty: every repo in that owner's installation. Both empty: only the current repo.
- "By default, the token inherits all of the installation's permissions"; the README recommends listing the
  `permission-*` inputs explicitly. A permission the installation lacks causes an error.
- "An installation access token expires after 1 hour." Unless `skip-token-revoke: true`, "the token is revoked in
  the `post` step of the action", so it "cannot be passed to another job".
- Git CLI pushes run as the bot user after you set the bot's name and email. Use `persist-credentials: false` on any
  checkout.

REST API behind it (<https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app>):
1 hour expiry, `repositories`/`repository_ids` and `permissions` narrow the token, at most 500 repositories. Since
2026-04-27 GitHub is rolling out a new token format; do not assume tokens are 40 characters.

Sketch (token job only) **[inference]**:

```yaml
- id: app-token
  uses: actions/create-github-app-token@<sha> # v3
  with:
    client-id: ${{ vars.DOCS_MIGRATION_APP_CLIENT_ID }}
    private-key: ${{ secrets.DOCS_MIGRATION_APP_KEY }}
    owner: wso2
    repositories: ${{ needs.plan.outputs.repo_name }}   # validated ^docs-[a-z0-9-]+$ in the plan job
    permission-contents: write
    permission-pull-requests: write
```

Store the private key as an environment secret, with the environment limited to the default branch and optionally
requiring reviewers, so that only the token job (which names the environment) can read it **[not re-fetched; check
GitHub "Managing environments for deployment"]**.

**Minimum App permissions.**
- Contents: read and write. Needed for git push, git refs and the contents/Git Data APIs. The REST permissions page
  lists `POST/PATCH /repos/{o}/{r}/git/refs` under Contents (write)
  (<https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps>).
- Pull requests: read and write. Needed for `POST /repos/{o}/{r}/pulls` and `PATCH .../pulls/{n}` (same page).
- Metadata: read. GitHub forces this on whenever any repository permission is selected (GHES-era docs of the same
  page; current github.com wording not re-confirmed, **[partly unverified]**).
- Workflows: request it only if the App must "access or edit files in `.github/workflows`"
  (<https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app>).
  The same REST page lists contents PUT/DELETE and git refs create/update under Workflows (write) as "additional
  permissions", meaning they also need Workflows when they touch workflow files. A push without it fails with
  "refusing to allow a GitHub App to create or update workflow ... without `workflows` permission"
  (<https://github.com/actions/create-github-app-token/issues/301>, closed with no root cause found).
  - The migration tree never writes `.github/workflows/` (question 6), so do not grant Workflows. It would let a
    compromised token add workflows to `wso2/docs-*`, which then run with those repos' secrets.
  - **[unverified]** Whether GitHub also rejects a force-push whose new history includes *existing* edit-branch
    commits that changed workflow files (the standing branch rebased onto a newer edit tip). Community reports of
    PAT pushes after merging `main` suggest it can. Mitigations: (a) each run, start from the fresh edit-branch tip
    and add one commit, so the push is that tip plus one commit; (b) create the commit through the Git Data API
    (`base_tree` = edit tip, then update the ref with `force: true`), which never sends workflow files. Test (a) once
    against a content repo whose edit branch has a recent workflow change.
- Optional: Issues write, only to label or assign the PR through the Issues API. Not needed to open the PR.
- PRs opened with an App token trigger the content repo's `pull_request` workflows. `GITHUB_TOKEN` events do not
  (<https://docs.github.com/en/actions/concepts/security/github_token>). Content repo CI therefore runs on the
  migration PR; the base branch's workflow files decide what runs.

## 2. Fine-grained PAT as a fallback

Sources: <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens>,
<https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/setting-a-personal-access-token-policy-for-your-organization>.

- **Ownership.** A PAT acts on its owner's behalf, with no more access than the owner has. GitHub says that for org
  resources or long-lived integrations you "should use a GitHub App". Pushes and PRs show up as that person.
  If the person leaves or loses write access, the workflow breaks **[inference; the policy page does not say what
  happens to tokens when a member leaves]**.
- **Expiry.** You set an expiry; the default is 30 days. "Infinite lifetimes are allowed" unless an org policy caps
  them, and the default org maximum for fine-grained tokens is 366 days. Rotation is a manual, personal chore.
- **Org approval.** "Require administrator approval" is the default. Until an org owner approves it the token is
  "pending" and can read only public resources. Owners' tokens are approved automatically, which tempts people to
  use an owner's token (worse) **[inference]**. Orgs can also block fine-grained PATs entirely.
- **Scope.** A fine-grained PAT has one resource owner and can be limited to selected repos and permissions
  (Contents, Pull requests), which is comparable to the App. It cannot be narrowed per run, and it does not expire
  after an hour.
- **Verdict [inference].** Acceptable as a stop-gap for a pilot on one repo (for example while the App waits for an
  owner), with a short expiry and only the target repo. Not acceptable as the standing design. A classic PAT is not
  acceptable at all: `repo` scope covers every repo the person can reach.

## 3. Keeping the token out of the conversion job

What `docs-site-snapshots.yml` already does (`/.github/workflows/docs-site-snapshots.yml`):
- Workflow-level `permissions: contents: read` (10-11). Checkout with `persist-credentials: false` (26-27, 49-50).
  `npm ci --ignore-scripts` (30, 53). Actions pinned to commit SHAs.
- The build job runs fetch, convert and render with read-only permissions and "never sees the write token" (36-37).
  It uploads one `.tgz` with `if-no-files-found: error` and `retention-days: 1` (58-63).
- The upload job has `contents: write` for that job only (72-73). It has "no checkout, no npm and no repository
  script" (64-65). It checks the key is 64 lowercase hex characters, that the artifact holds exactly `$KEY.tgz`,
  that it is a regular file and not a symlink (93-96), and it never unpacks or runs the tarball.

Applying this to Migration **[inference]**:
- **convert** job: `contents: read`, no App secret. Runs `fetch-sources.mjs <section>`, then
  `migrate-docusaurus.mjs <section> $RUNNER_TEMP/tree`. Packs `tar -C tree -czf tree.tgz .` (the marker is a dot
  file; see below), writes `sha256sum tree.tgz`, and uploads `tree.tgz`, `tree.sha256`, `tree-review.txt` and
  `content-report.json` (or a small `pr-body.md` built here) as one artifact with `retention-days: 1`.
- **pr** job: environment with the App key; steps limited to `download-artifact`, shell, `git`, `gh` and
  `create-github-app-token`. It checks out the **content repo** (data, not code) with `persist-credentials: false`
  and passes the token only to the push and `gh` steps through `env:`. It never checks out docs-site and never runs
  `npm`, `node` or a script from the artifact.
- `upload-artifact` ignores hidden files by default ("to avoid unintentionally uploading sensitive information",
  <https://github.com/actions/upload-artifact>). Uploading the tree folder directly would lose `.wso2-docs-tree`
  (tree.ts:130,138), so pack a tarball, as snapshots do.
- **Artifact poisoning risks.** Jobs in one workflow "can interact with (and compromise) other jobs", and artifacts
  from other workflows (`workflow_run`) need caution (<https://docs.github.com/en/actions/reference/security/secure-use>).
  The convert job runs third-party content through the converter. A malicious source could make it write anything
  into the artifact, but it cannot alter the token job's code if that job runs nothing from the artifact.
  - Artifacts from `upload-artifact@v4+` are immutable within the run (the README notes `overwrite: true` replaces
    them by name). `download-artifact` (v8) checks the server digest, `digest-mismatch: error` by default
    (<https://github.com/actions/download-artifact>). Keep that default and download by name within the same run
    only; never use `run-id`/`github-token` to pull another run's artifact.
  - The extra `tree.sha256` comes from the same untrusted job, so it detects corruption, not tampering. The real
    defence is validating the contents.
  - Validate before extraction: `tar -tzvf` lists only regular files and directories (no `l`/`h` types, no device
    files), no absolute paths, no `..` segment, and no entry starting with `.github/` or `.git/`. Extract with GNU
    tar `--no-same-owner --no-same-permissions` into an empty temp dir, then `find -type l` must be empty. Cap the
    total size.
  - Validate `migrate_to` in the plan job against an allow-list regex such as `^[a-z0-9][a-z0-9._-]*(/[a-z0-9][a-z0-9._-]*)*$`,
    with no `..`, not `.github` or `.git`, and not the repo root. Pass it through `env:`, never interpolated into
    `run:`.
  - After copying into `<content checkout>/<migrate_to>`: `git status --porcelain` and `git diff --name-only <base>`
    must list only paths under `migrate_to/`; fail otherwise.
  - Treat the PR body as untrusted text. Write it to a file and pass it with `gh pr create --body-file`, never through
    shell interpolation. Truncate it to the API body limit (65,536 characters **[unverified]**) and link to the run
    artifact for the full report.

## 4. Force-pushing the standing PR branch

- **Approvals.** When "dismiss stale pull request approvals" is on, an approval "is dismissed as stale" when "commits
  are pushed that affect the diff". It is also dismissed if the merge base brings in new changes
  (<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>).
  A rerun that yields a byte-identical tree on the same base should not dismiss anything **[inference]**: skip the
  push when the new tree equals the branch's tree (`git diff --quiet origin/docs-site/migration`).
- **Most recent push.** With "Require approval of the most recent reviewable push", someone other than the last
  pusher must approve. The App is always the last pusher, so a human must approve after each run **[inference from
  rulesets doc]**. That is the intended gate.
- **Review comments.** Line comments on changed lines become "outdated". GitHub's commenting page only names the
  "outdated" state and does not define what triggers it **[unverified]**. Force-pushes also show in the PR timeline
  as "force-pushed from A to B" **[unverified, from experience]**.
- **CODEOWNERS.** Reviews are requested "when someone opens a pull request that modifies code that they own", using
  the base branch's `CODEOWNERS`. Drafts get no automatic requests, and marking a draft ready requests them
  (<https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners>).
  The docs do not say pushes request them again. Opening the PR as a draft and letting a person mark it ready
  avoids pinging owners on every rerun **[inference]**. Code owners must have write access.
- **Can rules block the bot?**
  - Classic branch protection on the *base* (edit) branch does not stop pushing a different head branch or opening a
    PR **[inference: rules are configured per protected branch]**.
  - Rulesets with a pattern that matches `docs-site/migration` (or `~ALL`) can: "Restrict creations" / "Restrict
    updates" allow only bypass actors, and "Block force pushes" is on by default in a new ruleset. GitHub Apps can be
    bypass actors
    (<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets>).
    Ask content repo admins to exclude `docs-site/migration` from force-push blocking or add the App as a bypass
    actor for that branch only. **[unverified: `~ALL` matching details were not on the page fetched.]**
  - The App cannot open the PR if repo or org settings stop Apps from creating PRs **[unverified, no such setting
    found]**. The App installation must include the repo (question 5).
- **Signed commits.** "Require signed commits" means "contributors and bots can only push commits that have been
  signed and verified to the branch". When set on the base branch, "unsigned commits on the head branch can block a
  squash merge, even though GitHub would sign the final squash commit" (about-protected-branches page above).
  - A `git commit` in the runner is unsigned unless we hold a signing key.
  - Commits made through the API, authenticated as the App, with no custom author, committer or signature, are
    marked verified ("Signature verification for bots",
    <https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification>).
  - So if any `wso2/docs-*` base branch requires signatures, build the commit with the Git Data API (blobs, tree with
    `base_tree`, commit, `PATCH` ref with `force: true`), not `git push`.
  - Cost: one blob request per changed file. A full docs-is tree (thousands of pages and images) may hit
    installation rate limits; unchanged files reuse the base tree, but the first run sends every file
    **[inference; measure the tree's file count]**.

## 5. Who creates and installs the App

- **Register.** You can register an App "under any organization you own" or one "that has granted you permission to
  manage all its apps" (an App manager for all apps)
  (<https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app>).
  Choose "Only on this account" (private), turn the webhook off (deselect **Active**, since the App only
  authenticates), and grant only the permissions in question 1.
- **App managers.** Org owners designate them; they "manage the settings of some or all" of the org's App
  registrations, but the role "does not grant recipients access to install and uninstall GitHub Apps"
  (<https://docs.github.com/en/apps/maintaining-github-apps/about-github-app-managers>).
- **Install.** "Organization owners can install GitHub Apps on their organization". Repo admins can install on repos
  they administer if the App requests no organization permissions and no Administration permission, unless owners
  restrict that. Others can only send an install request to owners
  (<https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party>).
- **Selected repos.** At install time pick "Only select repositories" and list the content repos (`wso2/docs-is`,
  `wso2/docs-apim`, `wso2/docs-mi`, `wso2/docs-api-platform`, ...). Adding a repo later is an installation settings
  change (owner, or an admin of that repo). Also narrow `repositories:` per run in the workflow.
- **Private App across orgs.** A private App "can only be installed on the account that created it"
  (<https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app>). If the public workflow repo
  and the content repos are both in `wso2`, a private App owned by `wso2` works. If content ever moves to another
  org, the App must be public, or one App per org **[inference]**.
- **Permission changes.** Adding a permission later prompts each installation owner to approve, and "their
  installation will continue to use the old permissions" until they do (choosing-permissions page above). Get it
  right the first time.
- **Key handling [inference].** Generate one private key, store it only as the environment secret, keep the client
  ID in a variable, rotate yearly, and delete the downloaded `.pem`. The key mints tokens for every installed repo,
  so the environment's deployment branch rule (default branch only) is what stops a PR branch from using it.

## 6. What `migrate-docusaurus.mjs` produces

Code: `docs-site/scripts/migrate-docusaurus.mjs`, `docs-site/scripts/build-content.mjs`,
`docs-site/packages/docs-converter/src/tree.ts`.

- **Inputs and run.** Usage `<sectionId> <outDir> [--edit-branch <b>] [--every-include]` (migrate-docusaurus.mjs:2).
  - It reads the lock (`DOCS_SITE_LOCK` honoured, lib.mjs:11) and converts every live version of the section with
    `build-content.mjs --partials --source-tree <versionIds>` (migrate-docusaurus.mjs:27-33).
  - It needs the sources already fetched into the checkout cache (`checkoutDir`, :40), so the convert job runs
    `fetch-sources.mjs <section>` first.
  - CI accepts only `wso2/*` repos (lib.mjs:13-14). Today's migrated entries point at `tharindulak/*` forks and run
    locally only (content-sources.yaml:210-214, 320-322).
- **Fails on new conversion failures.** build-content sets `process.exitCode = 1` for failing pages not on the
  exclude list (build-content.mjs:312-321, 404-407). `execFileSync` throws on a non-zero exit, so migrate stops
  without writing a tree. Without `--onboard`/`--prune` it does not rewrite `content-sources.yaml` (build-content.mjs:315-330,
  393-403). Good: the convert job leaves the lock alone.
- **Tree layout** (tree.ts:130-225), all under `outDir`:
  - `.wso2-docs-tree`, the marker. `prepareOut` refuses a non-empty `outDir` without it, and otherwise **deletes
    `outDir` recursively** (tree.ts:133-139). Run it only on a runner temp dir, never on the content checkout.
  - `docs/**.mdx` (Latest), `versioned_docs/version-<v>/**.mdx` (tree.ts:155, 214).
  - `sidebars.json`, `versioned_sidebars/version-<v>-sidebars.json` (:219), `versions.json` (:221).
  - `redirects.json` only when a version has MkDocs `redirect_maps` (:222-224).
  - `assets/<key>` and `assets/_versions/<v>/<key>`; `static/<key>` and `static/_versions/<v>/<key>` (:42-60,
    151-152).
  - Output is deterministic for the same input (:141-144), so an unchanged rerun gives an empty diff.
  - Edit links in front matter are rewritten to `https://github.com/<o>/<r>/edit/<branch>/...`. The branch is
    `--edit-branch`, else the section's `cloud.track`/`track`/Latest's `track`, or per version its `ref` if it is a
    branch name (migrate-docusaurus.mjs:47, 58, 60; tree.ts:98-103, 147-149). The workflow should pass
    `--edit-branch` equal to the PR's base branch.
- **Outside the tree** (in `docs-site/generated/`, not in `outDir`):
  - `tree-review.txt`: a two-line header, then `file:line` per nested `<Steps>` whose closing tag a writer should
    check, with paths relative to the tree root (migrate-docusaurus.mjs:62-69; tree.ts:217).
  - `content-report.json`: per version `section`, `ok`, `redirected`, `failures[]`, `nowPassing[]`, `droppedNav[]`,
    `merge{splitBlocks,diverged}`, `partials{written,inlined[]}`, `frontMatter[]`, `fresh`, `seconds`
    (build-content.mjs:304, 331-333, 392; packages/docs-converter/src/site.ts:32-46).
  - Also `generated/docs/<versionId>/`, sidebars and static files (intermediate, not for the PR).
- **PR body should carry [inference]:**
  - section id and route
  - each version with its source repo and pinned SHA from the lock
  - docs-site commit SHA and the workflow run URL
  - per version: ok / redirected / excluded failures / dropped nav / front-matter problems, from content-report
  - the `tree-review.txt` list as a checklist, with links to `blob/docs-site/migration/<migrate_to>/<file>#L<line>`
  - a "generated, do not hand-edit until cutover, rerun the workflow instead" note (matching the marker text,
    tree.ts:138)
  - whether the base branch moved since the last run
- **Could it write `.github/`?** Not at the tree root. Every page path is prefixed `docs/` or `versioned_docs/...`,
  assets `assets/`, static files `static/` (tree.ts:155, 192, 189/198/209). `walk` includes dot-paths
  (site.ts:96-99), so a source file such as `.github/x.md` inside a docs folder would land at `docs/.github/x.mdx`.
  That is harmless to Actions, which reads only the repo-root `.github/workflows/` **[inference]**. The only way to
  reach repo-root `.github/` is a `migrate_to` of `.github...` or the repo root, which the validation in question 3
  rejects.
- **Not there yet.** `content-sources.yaml` has no `migrate_to:` key and no section-level `edit:` today. The only
  `edit:` is on a `cloud_companion` (content-sources.yaml:567). Today the tree location is given by `tree_root`
  (for example `docusaurus`, :216) after cutover. The Migration workflow needs `migrate_to` added to the lock schema
  and to `readLock` validation.

## Open items to verify

- Whether a force-push that includes existing edit-branch commits touching `.github/workflows/` is rejected without
  the Workflows permission (test once on a content repo).
- What triggers "outdated" review threads, and whether CODEOWNERS are re-requested on pushes (not in current docs).
- The rulesets set on each `wso2/docs-*` repo and org (signed commits, force-push blocking on `~ALL`): ask the repo
  admins or check with `gh api repos/wso2/<repo>/rulesets`, which needs admin read.
- Docs-is migration tree file count and size, to size the artifact and the Git Data API approach.
- The PR body size limit.
