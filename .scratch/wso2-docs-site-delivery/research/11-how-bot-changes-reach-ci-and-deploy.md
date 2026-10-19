# 11 How bot changes reach CI, snapshots and deploy (researched 2026-10-19)

Ticket: "How bot changes reach CI, snapshots and deploy". Context: the planned Deploy workflow runs on `workflow_run` after `docs-site snapshots` succeeds, plus `workflow_dispatch`. A GitHub App (contents + pull_requests write) is already planned for cross-repo migration PRs.

Sources: GitHub Docs and changelog (URLs inline), the workflow files in this repo, and the live repo settings read with `gh api` on 2026-10-19. **[inference]** marks my reasoning. **[unverified]** marks something no primary source confirms. No fetched page had text addressed to an AI.

## Short answers

1. **Suppressed events.**
   - The bump PR (opened or pushed with `GITHUB_TOKEN`) **does** create a `docs-site CI` run. Since June 2026 the run starts in an **approval-required** state, and a user with write access must click "Approve workflows to run". This happens on every `opened`/`synchronize`/`reopened`, and the bump force-pushes, so that is every hourly push. Until someone approves, the required check never passes, so auto-merge never fires.
   - If the PR does merge through auto-merge enabled with `GITHUB_TOKEN`, the merge is attributed to the enabler (`github-actions[bot]`), not to the last approver **[unverified in GitHub Docs; stated by a widely used action's README]**. The resulting `push` creates **no** workflow run, so snapshots does not run, the `workflow_run` never fires, and Deploy does not run.
   - Promotion PRs are merged by a human, so their push triggers normally.
   - "Allow GitHub Actions to create and approve pull requests" is **off** on this repo (`can_approve_pull_request_reviews: false`), so today `gh pr create` with `GITHUB_TOKEN` fails outright.
2. **Branch mismatches.** The default branch is `docs-site-build`. `docs-site snapshots` listens on `push` to `[main, docs-site-versions]` (`.github/workflows/docs-site-snapshots.yml:7`), and **neither branch exists** on the remote. So snapshots never runs on a merge. The other triggers are fine. Separately, several repo settings block the design today: Actions is disabled, auto-merge is not allowed, and there is no branch protection and no CODEOWNERS (section 2).
3. **Options.**
   - (a) A GitHub App installation token makes every event normal: CI runs without approval, and the auto-merge push triggers snapshots and then Deploy. This is the documented fix.
   - (b) `gh workflow run` from `GITHUB_TOKEN` can start CI, but it cannot cover the asynchronous auto-merge push. You would need a watcher or polling, which is fragile.
   - (c) A scheduled Deploy is a cheap backstop for any missed chain, not a primary path.
   - (d) A fine-grained PAT works but is tied to a person and expires. GitHub says to use an App for org automation.
4. **Recommendation.** Use a **separate, single-repo "docs-site bot" GitHub App** for the bump and promotion workflows. Mint its token only in the step that pushes and opens the PR, scoped with `repositories:` and `permission-*`. Fix the snapshots branch filter to `docs-site-build`. Require the `docs-site CI` check (and CODEOWNERS review on `content-sources.yaml`) through branch protection, with no bypass for the App. Keep "Allow GitHub Actions to create and approve pull requests" off. Add a daily scheduled Deploy as a backstop.

## 1. Which events are suppressed

### What GitHub documents

- "events triggered by the `GITHUB_TOKEN` will not create a new workflow run", with two exceptions: "`workflow_dispatch` and `repository_dispatch` events always create workflow runs", and for pull requests "the resulting `pull_request` event creates workflow runs in an **approval-required** state". A user with write access starts them via "Approve workflows to run". To avoid the approval step, "use a GitHub App installation access token or a personal access token instead of `GITHUB_TOKEN`". Sources: [GITHUB_TOKEN concepts](https://docs.github.com/en/actions/concepts/security/github_token) and [Triggering a workflow from a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
- The `pull_request` event reference says: "When a pull request is created or updated by a workflow using `GITHUB_TOKEN`, `pull_request` events with the `opened`, `synchronize`, or `reopened` activity types create workflow runs that require approval … With the exception of `workflow_dispatch` and `repository_dispatch`, other `GITHUB_TOKEN`-triggered events do not create workflow runs at all." ([events-that-trigger-workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows))
- For pushes: "a new workflow will not run even when the repository contains a workflow configured to run when `push` events occur" ([GITHUB_TOKEN concepts](https://docs.github.com/en/actions/concepts/security/github_token)).
- The approval-required behaviour is new. Changelog, 2026-06-11: [Bot-created pull requests can run workflows if approved](https://github.blog/changelog/2026-06-11-bot-created-pull-requests-can-run-workflows-if-approved/). Before that, `github-actions[bot]` PRs ran no workflows at all. The post does not say whether App or PAT PRs are affected. Per the docs above, they never were suppressed.
- Fork-run approvals that wait more than 30 days "expire and are marked as failed" ([approve runs from forks](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/approve-runs-from-forks)). The page does not say whether this applies to bot-PR approvals **[unverified]**.

### Applied to this repo

| Step | Caused by | Creates a run? |
|---|---|---|
| Bump branch push (`docs-site-content-bump.yml:47`, `git push --force` with `x-access-token:${GH_TOKEN}` = `github.token`) | GITHUB_TOKEN | `push` workflows: no. No push workflow matches `bot/*` anyway. |
| Bump PR opened (`:49`) or updated by force-push | GITHUB_TOKEN | `docs-site CI` (`docs-site-ci.yml:3-5`, `pull_request`, paths `docs-site/**`): **yes, but approval-required**. It needs a human click on every hourly force-push. |
| Auto-merge enabled (`:50`, `gh pr merge --auto --squash`) | GITHUB_TOKEN | Not an event that matters by itself. |
| Merge commit pushed to `docs-site-build` when checks pass | Attributed to the auto-merge enabler, `github-actions[bot]` **[unverified in GitHub Docs]** | **No.** The `docs-site snapshots` `push` run is not created, so no `workflow_run` and no Deploy. |
| Promotion PR opened (`docs-site-version-promotion.yml:61-62`) | GITHUB_TOKEN | CI: yes, approval-required. The reviewer can click "Approve workflows to run" while reviewing. |
| Promotion PR merged by a docs-team human | Human | **Yes.** The push triggers snapshots (once the branch filter is fixed), then Deploy. |

On merge attribution: GitHub's [auto-merge doc](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request) does not say who the merge is attributed to. The README of the widely used [peter-evans/enable-pull-request-automerge](https://github.com/peter-evans/enable-pull-request-automerge) says "if you use the default `GITHUB_TOKEN` … the merge will not trigger further workflow runs". Community reports agree (e.g. [community discussion 27146](https://github.com/orgs/community/discussions/27146)). I therefore treat "the merge acts as the enabler, not the last approver" as very likely but **[unverified]** against GitHub's own docs. The bump PR has no approver in any case: it auto-merges on CI alone.

**The `workflow_run` chain [inference]:** snapshots never starts for a GITHUB_TOKEN auto-merge, so Deploy (`workflow_run` on snapshots) cannot start either. `workflow_run` has two documented limits: it fires only if the workflow file is on the default branch, and chains are limited to three levels ([events-that-trigger-workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)). The chain push → snapshots → Deploy is two levels, so that is fine. Whether `workflow_run` fires after a snapshots run that was *itself* started by a GITHUB_TOKEN `workflow_dispatch` is **[unverified]**. Test it if you choose option (b).

### "Allow GitHub Actions to create and approve pull requests"

- This is a single checkbox under Workflow permissions. For personal-account repos, workflows "are not allowed to create or approve pull requests" by default. Org repos inherit the org setting ([managing Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)).
- On this repo it is off: `gh api repos/tharindulak/wso2-docs-site/actions/permissions/workflow` returns `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}`. So with GITHUB_TOKEN, `gh pr create` at `docs-site-content-bump.yml:49` and `docs-site-version-promotion.yml:62` would fail today **[inference from the documented setting; not run]**.
- The same checkbox also lets `GITHUB_TOKEN` *approve* PRs. Turning it on would let any workflow with `pull-requests: write` approve a bot PR, which weakens a required-review gate **[inference]**. With an App token, the checkbox can stay off.

## 2. Triggers against branch names

The default branch is verified: `gh repo view` gives `defaultBranchRef: docs-site-build`, and `origin/HEAD` points to `refs/remotes/origin/docs-site-build`. `git ls-remote --heads origin` shows **no `main` and no `docs-site-versions`**.

| File:line | Trigger | Status |
|---|---|---|
| `.github/workflows/docs-site-snapshots.yml:6-8` | `push: branches: [main, docs-site-versions]`, paths `docs-site/**`, workflow files | **Mismatch.** Neither branch exists, so the workflow never runs on merges to `docs-site-build`. Should be `[docs-site-build]` (later, the wso2 repo's default branch). Only `workflow_dispatch` (`:9`) works today. |
| `.github/workflows/docs-site-ci.yml:3-6` | `pull_request` (no branch filter), paths; `workflow_dispatch` | OK. Runs for PRs into any base. Bump and promotion PRs touch `docs-site/content-sources.yaml`, so the path filter matches. |
| `.github/workflows/docs-site-content-bump.yml:4-7` | `schedule` hourly; `workflow_dispatch` | OK. Schedules run only on the default branch ([docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)), which is `docs-site-build`. `gh pr create` (`:49`) has no `--base`, so it targets the default branch. OK. |
| `.github/workflows/docs-site-version-promotion.yml:4-7` | `schedule` daily; `workflow_dispatch` | OK, for the same reasons (`:62` has no `--base`). |
| Planned Deploy | `workflow_run: workflows: [docs-site snapshots], types: [completed]` | Must filter `branches: [docs-site-build]` and check `github.event.workflow_run.conclusion == 'success'`. The file must be on the default branch. |

Other blockers found while checking (`gh api`, 2026-10-19). These are not trigger mismatches, but each one stops the design:

- **Actions is disabled** on the repo: `actions/permissions` returns `{"enabled":false}`, and `actions/workflows` returns `total_count: 0`.
- **Auto-merge is not allowed**: `allow_auto_merge: false`. `gh pr merge --auto` at `docs-site-content-bump.yml:50` would fail **[inference; not run]**. GitHub: "Before you use auto-merge, it must be enabled for the repository", and auto-merge only applies when a rule such as required status checks blocks an immediate merge ([auto-merge doc](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)).
- **No branch protection is possible**: branch protection and rulesets return HTTP 403 "Upgrade to GitHub Pro or make this repository public". The required-check gate that the bump comment assumes (`docs-site-content-bump.yml:1-2`) cannot exist on this private repo under the current plan.
- **There is no CODEOWNERS file** anywhere in the repo, but `docs-site-version-promotion.yml:2` relies on one ("one approval from the product's docs team is required (CODEOWNERS)").
- Side observation, outside this ticket's scope **[inference; not run]**: `bump-sources.mjs --promotions --write` (`docs-site-version-promotion.yml:32`) writes every promotion into `content-sources.yaml` at once. The loop's first `git commit -am` (`:60`) commits all of them to the first `bot/promote-*` branch. After `git switch -` (`:63`), later iterations have nothing to commit, and the step fails under bash `-e`. Worth a separate check.

## 3. Options

### (a) GitHub App installation token for the bots

How it works: `actions/create-github-app-token` mints a token per job. It accepts `owner`, `repositories` ("list of repositories to grant access to") and `permission-<name>` inputs. Without the permission inputs, "the token inherits all of the installation's permissions". The token "expires after 1 hour" and is revoked in the action's post step ([action README](https://github.com/actions/create-github-app-token); [installation token docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)). Events caused by the App token behave normally: CI runs without approval, and the auto-merge push triggers snapshots and then Deploy ([GITHUB_TOKEN concepts](https://docs.github.com/en/actions/concepts/security/github_token)).

- Pros:
  - This is the documented fix.
  - It needs no human click.
  - "Allow GitHub Actions to create and approve PRs" can stay off.
  - Commits and PRs show as the App, which makes them easy to audit.
- Cons:
  - It needs a private key stored as a secret, and App setup.
  - The token is minted in a job that also ran repository code, so step ordering matters (see the security notes).
- Same App as the migration PRs, or a separate one?
  - The migration App needs write access to the **wso2 content repos** (cross-repo PRs). The bump and promotion bots need write access only to the **docs-site repo** (plus `issues: write` for promotion issues, or keep issues on `GITHUB_TOKEN`).
  - Whoever holds an App's private key can mint a token for every repo the App is installed on, with every permission the App has. Per-job `repositories:`/`permission-*` narrows each token, but not the key **[inference from the docs above]**.
  - With one shared App, a leaked docs-site secret means write access to the product docs repos as well.
  - **Prefer a separate App** installed only on the docs-site repo, with Contents RW, Pull requests RW and Issues RW, and without the Workflows permission. GitHub Apps need the `workflows` permission to change files under `.github/workflows` **[unverified in this pass]**, so leaving it out keeps the bot from editing CI.
  - If you must use one App, at least pass `repositories: <docs-site repo>` and explicit `permission-*` inputs on every mint.

### (b) Bot chains with `gh workflow run`

`workflow_dispatch` from `GITHUB_TOKEN` always creates a run (docs above). The bump job would add `actions: write` to its `permissions:` and call `gh workflow run "docs-site CI" --ref bot/content-bump`. The exact permission name for the dispatch endpoint is **[unverified]**: the [REST page](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event) only states classic `repo` scope.

- Pros:
  - No new credential.
  - Works today once Actions is enabled.
- Cons:
  - It is unclear whether a dispatch-started CI run on the head SHA satisfies the PR's required status check **[unverified; test it]**.
  - The real gap is after the merge. Auto-merge happens asynchronously, maybe an hour later (CI took about 47 minutes in the pilot, `docs-site-ci.yml:18`). The merge push is still suppressed, so something must notice the merge and dispatch snapshots. Either the hourly job compares `docs-site-build` HEAD with the last deployed SHA, or the bump stops using auto-merge and blocks on `gh pr checks --watch` then `gh pr merge` then `gh workflow run snapshots`, which holds a runner for the whole CI run.
  - It adds bespoke chaining logic that the App option makes unnecessary.
  - Promotion PRs would still need the approve-workflows click.

### (c) Scheduled Deploy as a backstop

Add `schedule` (for example daily) to Deploy, next to `workflow_run` and `workflow_dispatch`. Deploy should be idempotent: build from the committed lock plus the stored snapshots, then publish.

- Pros:
  - It catches any missed chain: a suppressed event, a snapshots run that did not match the paths filter, or a cancelled run.
  - It is cheap to add.
- Cons:
  - Latency of up to one schedule period.
  - It publishes whatever is on the default branch, even if snapshots for a new key are still missing. Deploy must handle missing keys, for example by failing, or by using `--allow-missing` and warning.
  - In a public repo, scheduled workflows "are automatically disabled when no repository activity has occurred in 60 days" ([docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)). This matters once the repo moves to the public wso2 org. Bump commits keep the repo active only while content changes.

It works only as a backstop: on its own, it makes the "auto-merge then deploy" path wait for the schedule.

### (d) Fine-grained PAT

- Pros: simple, and events trigger normally.
- Cons:
  - "tied to the user who generated them and will become inactive if the user loses access".
  - Org owners can enforce maximum lifetimes and "can require approval for any fine-grained personal access tokens".
  - GitHub: "To access resources on behalf of an organization, or for long-lived integrations, you should use a GitHub App" ([PAT docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)).
  - Commits appear as a person, and the token breaks when that person leaves or the token expires.
- Use only as a short-lived stopgap in the personal repo, not for the wso2-org repo.

### Security notes (apply to (a) and (d))

With an App token plus auto-merge, a change in a **content repo** reaches **production** without a human. The bump moves Latest to the head of the tracked branch and moves versions to new fix tags. Whoever can push to those content repos' tracked branches or tags can therefore publish to the site within about two hours. The gates that remain, and how to keep them real:

1. **Required status check `docs-site CI`** on `docs-site-build` (tests, build, link check: `docs-site-ci.yml:34-45`).
   - The repo must be public or on a plan with branch protection (it currently returns 403).
   - Pin the check's expected source to GitHub Actions. Branch protection lets you "select an app … as the expected source of status updates" ([about protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)), so a token with `statuses: write` cannot fake a pass.
   - Do not give the App the Checks or Statuses permission.
2. **No bypass for the bot.** Do not add the App to the bypass list. Enable "Do not allow bypassing the above settings": by default protections "do not apply to people with admin permissions" (same doc).
3. **CODEOWNERS on promotions.**
   - Add `.github/CODEOWNERS` with per-section docs teams on `docs-site/content-sources.yaml` (or the per-section files if they get split), and enable "require reviews from code owners".
   - Caveat **[inference]**: bump PRs touch the same file. If code-owner review is required, bump PRs also need a human approval, which breaks auto-merge. Options:
     - split bump-owned fields (pinned SHAs and fix tags) from promotion-owned fields (which version is Latest) into separate files with different owners;
     - or have a CI check fail a `content-bump`-labelled PR that changes anything other than SHAs and fix tags.
     - Decide this in the planning map.
4. **Keep "Allow GitHub Actions to create and approve pull requests" off.** Then no workflow token can approve a promotion PR. The App cannot approve its own PRs because it is the author **[inference: GitHub does not allow PR authors to approve their own PRs]**.
5. **Token hygiene.**
   - Mint the App token in the last step, or better in a separate job that only receives the diff as an artifact. That is the pattern `docs-site-snapshots.yml:64-65` already uses for its write job: "no checkout, no npm and no repository script runs here".
   - Keep `persist-credentials: false` (already set).
   - Store the App private key as an **environment** secret, with the environment restricted to the default branch.
6. **Content repos are an input, not a trust boundary** **[inference]**. CI runs content-derived conversion with a read-only token (`docs-site-ci.yml:7-8`). Keep it that way, because the bump PR's CI executes whatever the content repo's HEAD contains through the converter.

## 4. Recommendation

1. **Fix the snapshots trigger** to `branches: [docs-site-build]` (and later the wso2 repo's default branch). Until then, nothing after a merge runs automatically, whatever token is used.
2. **Use a dedicated docs-site bot GitHub App**, separate from the migration App:
   - installed on the docs-site repo only;
   - permissions Contents RW, Pull requests RW and Issues RW (for promotion issues); no Workflows, Checks, Statuses or Administration;
   - use it for the push, `gh pr create` and `gh pr merge --auto` steps in both bot workflows, minted with `repositories:` and explicit `permission-*`;
   - the merge push then triggers snapshots, then Deploy through `workflow_run`.
3. **Repo settings for the target (public wso2-org) repo:**
   - Actions enabled;
   - auto-merge allowed;
   - branch protection or a ruleset on the default branch requiring `docs-site CI` from GitHub Actions as the expected source, with no bypass;
   - CODEOWNERS plus required code-owner review for promotions (resolve the shared-file caveat above);
   - "Allow GitHub Actions to create and approve pull requests" left off.
4. **Deploy triggers:** `workflow_run` (snapshots, completed, success, `branches: [docs-site-build]`), `workflow_dispatch`, and a **daily `schedule` backstop**.
5. **For the private personal repo before the App exists:**
   - Accept that bump PRs need an "Approve workflows to run" click and that snapshots and Deploy must be dispatched by hand after a bump merge.
   - Promotion PRs need only the approval click, because a human merges them.
   - Do not add a PAT just for the interim, unless it is a short-lived, single-repo fine-grained token.

Recommend peer review of the App permission set and the branch-protection configuration before the wso2-org cutover.
