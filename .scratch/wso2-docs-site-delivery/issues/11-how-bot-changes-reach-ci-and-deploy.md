# How bot changes reach CI, snapshots and deploy

Parent: [map](../map.md)
Type: research (AFK)
Status: closed
Assignee: tharindulak (research agent)
Blocked by:

## Question

The content-bump and version-promotion workflows open (and the bump auto-merges) PRs with `GITHUB_TOKEN`. GitHub does not start workflow runs for events that token causes, so a bump PR may never get `docs-site CI`, and its merge may never start `docs-site snapshots` or, through `workflow_run`, a deploy. Confirm this from GitHub's docs, check every trigger in `.github/workflows/docs-site-*.yml` against the branch names in use (default branch `docs-site-build`; snapshots listens on `main` and `docs-site-versions`), and list the options with their trade-offs: a GitHub App token for the bots (the same App as the migration PRs, or a second one), a scheduled deploy as a backstop, or `workflow_dispatch` chained by the bot. Surfaced by [Search index and deploy path](03-search-index-and-deploy-path.md).

## Resolution

Findings: `research/11-how-bot-changes-reach-ci-and-deploy.md` on branch `research/how-bot-changes-reach-ci-and-deploy` (commit 8c4c4b7).

- **Suppressed events:** bump PRs pushed with `GITHUB_TOKEN` do start `docs-site CI`, but awaiting approval (GitHub changelog 2026-06-11), so someone must approve every hourly push. A merge from a `GITHUB_TOKEN`-enabled auto-merge creates no push run: snapshots, `workflow_run` and Deploy never start. Merge commit attribution is undocumented (unverified). Promotion PRs are merged by a person, so their push triggers normally.
- **Branches:** default is `docs-site-build`; `docs-site-snapshots.yml:7` listens on `main` and `docs-site-versions`, neither of which exists on the remote. Other triggers are fine.
- **Repo settings today (`gh api`):** Actions disabled; auto-merge not allowed; "Allow GitHub Actions to create and approve pull requests" off (so the bots' `gh pr create` fails); branch protection unreadable on a private Free repo; no CODEOWNERS although the promotion workflow relies on one.
- **Options:** a GitHub App token is the documented fix; `gh workflow run` can start CI but not the delayed auto-merge push without polling; a scheduled deploy only as a backstop; a fine-grained PAT is tied to a person and expires.
- **Gates with an App token:** content-repo changes reach production without a person. What stays: required `docs-site CI` check (source pinned to GitHub Actions, no App bypass), CODEOWNERS on promotions, "create and approve" kept off. Caveat: bump and promotion PRs edit the same `content-sources.yaml`, so a required code-owner review would also block bump auto-merge; split the file or add a CI check limiting what a bump PR may change.
- **Recommendation (agent):** fix the snapshots branch filter; a separate single-repo docs-site bot App (Contents, Pull requests, Issues write; no Workflows, Checks, Statuses), token minted only in the push/PR step; require the CI check and add CODEOWNERS on the target repo; Deploy on `workflow_run`, `workflow_dispatch` and a daily schedule.
- **Side findings (unverified):** `docs-site-version-promotion.yml:32,60` likely fails with more than one pending promotion (the first commit takes all changes); whether a dispatch-started CI run satisfies a PR's required check.
