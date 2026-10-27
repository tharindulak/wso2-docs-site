# Backfill bundle store

Parent: [map](../map.md)
Type: grilling (HITL)
Status: open
Assignee:
Blocked by: 03, 06

## Question

Decide where backfill bundles live (a release on the docs-site repo like `docs-site-snapshots`, or elsewhere), how they are generated once from today's pinned SHAs and checked against what is live, how the lock marks a version as backfill, and how a team's later release for that version replaces it.

Inputs from [Docs-site intake spec](06-docs-site-intake-spec.md): version entries carry `tag`, `bundle: { asset, sha256 }`, `source_commit` and `backfill: true`; later fetches trust only the lock's sha256; a team's release for a backfilled version enters as (a) or (b).
