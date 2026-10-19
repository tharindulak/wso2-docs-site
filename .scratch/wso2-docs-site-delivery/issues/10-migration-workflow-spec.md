# Migration workflow spec

Parent: [map](../map.md)
Type: grilling (HITL)
Status: open
Assignee:
Blocked by: 06

## Question

Specify the Migration workflow from the charting decisions and its blocker: the `migrate_to:` lock field (name, validation, which sections set it), the read-only conversion job and how its output reaches the push job, branch and PR naming, the PR body (what changed, tree-review notes, how to merge at cutover), behaviour when the PR was closed or the branch edited by a person, and which content repos the App is installed on first (fork repos while testing here).
