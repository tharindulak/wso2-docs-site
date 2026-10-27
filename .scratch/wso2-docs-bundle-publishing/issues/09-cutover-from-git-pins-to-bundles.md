# Cutover from git pins to bundles

Parent: [map](../map.md)
Type: grilling (HITL)
Status: open
Assignee:
Blocked by: 05, 06, 07, 08

## Question

Plan the move from git pins to bundles for every section: order (one team first, then the rest), what each team must do and what the docs site does, how Latest stops tracking a branch, what happens to the content bump and promotion workflows and `CONTENT-RELEASES.md`, and the check that proves a section is fully on bundles.

Input from [Reusable bundle workflow spec](05-reusable-bundle-workflow-spec.md): rename AI Workspace's `release_tag` from `portals/ai-workspace/v` to `ai-workspace/v` in the lock; onboarding per repo (caller, manifest, CODEOWNERS, setup script) is part of each team's cutover.
