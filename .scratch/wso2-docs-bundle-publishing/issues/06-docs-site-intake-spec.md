# Docs-site intake spec

Parent: [map](../map.md)
Type: grilling (HITL)
Status: open
Assignee:
Blocked by: 01, 02, 03, 11

## Question

Specify the intake workflow on the docs-site repo: the 30-minute poll and dispatch, which releases count, verification before any content code runs (checksum, attestation signer, size and zip safety, manifest against the lock), the lock entry shape that replaces `sha`/`ref`/`track`, the product GA check, the auto-merging lock PR and its identity (the docs-site bot App), how several bundles at once are batched, and what a failed bundle produces (an issue on which repo).

Inputs from [Release facts on the forks](11-release-facts-on-the-forks.md): `GITHUB_TOKEN` can poll public content repos and verify attestations; require `immutable: true` on forks too; signer-workflow and source-ref pinning verified.
