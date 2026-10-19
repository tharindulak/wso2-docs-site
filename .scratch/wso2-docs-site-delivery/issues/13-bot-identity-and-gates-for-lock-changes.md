# Bot identity and gates for lock changes

Parent: [map](../map.md)
Type: grilling (HITL)
Status: open
Assignee:
Blocked by:

## Question

Bots that use `GITHUB_TOKEN` never start snapshots or Deploy after a merge (see [How bot changes reach CI, snapshots and deploy](11-how-bot-changes-reach-ci-and-deploy.md)). Decide: which identity the bump and promotion bots use (a separate docs-site bot App, the migration App, or no change plus a scheduled deploy); whether bump changes reach production with no person in the loop, and which gates stay (required CI check, CODEOWNERS); how bump and promotion PRs, which both edit `content-sources.yaml`, get different review rules (split the file, or a CI check limiting what a bump PR may change); and which Deploy triggers follow (`workflow_run`, dispatch, a daily backstop).
