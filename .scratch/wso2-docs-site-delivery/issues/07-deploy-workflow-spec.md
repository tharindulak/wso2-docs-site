# Deploy workflow spec

Parent: [map](../map.md)
Type: grilling (HITL)
Status: open
Assignee:
Blocked by: 01, 03, 04, 11, 12, 13

## Question

Specify the Deploy workflow end to end from the charting decisions in the map's Notes and the answers of its blockers: jobs and their permissions (which job sees the SSH key, which sees the Typesense admin key, which runs content code), the step order including indexing and the symlink switch, what stops a deploy and how it fails safe, concurrency (one deploy at a time; what happens to a queued one), release pruning, manual rollback, and how manual dispatch picks a commit.
