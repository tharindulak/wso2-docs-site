# Bot identity and gates for lock changes

Parent: [map](../map.md)
Type: grilling (HITL)
Status: closed
Assignee: tharindulak
Blocked by:

## Question

Bots that use `GITHUB_TOKEN` never start snapshots or Deploy after a merge (see [How bot changes reach CI, snapshots and deploy](11-how-bot-changes-reach-ci-and-deploy.md)). Decide: which identity the bump and promotion bots use (a separate docs-site bot App, the migration App, or no change plus a scheduled deploy); whether bump changes reach production with no person in the loop, and which gates stay (required CI check, CODEOWNERS); how bump and promotion PRs, which both edit `content-sources.yaml`, get different review rules (split the file, or a CI check limiting what a bump PR may change); and which Deploy triggers follow (`workflow_run`, dispatch, a daily backstop).

## Resolution

Decided with the user, 2026-10-19.

- **Identity:** a separate docs-site bot GitHub App installed on this repo only, with Contents, Pull requests and Issues write (no Workflows, Checks or Statuses). Not the migration App, which can write every `wso2/docs-*` repo.
- **No person in the loop for bumps:** content bumps (Latest `sha` to the tracked branch head) and docs fix releases (a version's `ref`/`sha` to a newer fix tag) auto-merge and deploy. The human gate is the content team's own review in its repo, plus required CI, the reachability rule and the link check against baselines.
- **Bump-shape required check:** passes when a PR changes only `sha` values (and fix-release `ref`s) of existing lock entries; any other change passes only after approval from the owning team of every section it changes structurally. Re-runs on review events. The bot App is a bypass actor for the code-owner rule only, so bumps auto-merge while promotions and anything else are held by the check.
- **Promotion approvers:** each lock section gets an `owners:` field naming a GitHub team; the check requires that team's approval. CODEOWNERS names a docs-site maintainers team for `content-sources.yaml` as the file's fallback owner. Owning teams need read access to the repo.
- **Deploy triggers:** `workflow_run` after `docs-site snapshots`, guarded by `head_branch` equal to the default branch, `event` equal to `push` and `head_repository` equal to this repo; manual dispatch; a daily scheduled run as a backstop. One concurrency group, a newer run replacing a queued one.
- **Key handling:** the bot App's private key lives in a `bot` environment limited to the default branch. The job running `bump-sources.mjs` (which reads remote data) gets no token; a separate step mints the token only to push and open the PR, and runs no repo or content code.
