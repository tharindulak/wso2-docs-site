# Docs-site intake spec

Parent: [map](../map.md)
Type: grilling (HITL)
Status: closed
Assignee: tharindulak
Blocked by: 01, 02, 03, 11

## Question

Specify the intake workflow on the docs-site repo: the 30-minute poll and dispatch, which releases count, verification before any content code runs (checksum, attestation signer, size and zip safety, manifest against the lock), the lock entry shape that replaces `sha`/`ref`/`track`, the product GA check, the auto-merging lock PR and its identity (the docs-site bot App), how several bundles at once are batched, and what a failed bundle produces (an issue on which repo).

Inputs from [Release facts on the forks](11-release-facts-on-the-forks.md): `GITHUB_TOKEN` can poll public content repos and verify attestations; require `immutable: true` on forks too; signer-workflow and source-ref pinning verified.

## Resolution

Decided with the user, 2026-10-27 (Q65 to Q73). Builds on [Where the build assumes git sources](01-where-the-build-assumes-git.md), [GitHub releases, attestations and safe zip intake](02-releases-attestations-and-safe-zip-intake.md), [Docs bundle layout and manifest](03-docs-bundle-layout-and-manifest.md), [Release facts on the forks](11-release-facts-on-the-forks.md), [Reusable bundle workflow spec](05-reusable-bundle-workflow-spec.md), and the delivery map's "Bot identity and gates for lock changes".

**Trigger.** Intake workflow on the docs-site repo: schedule `7,37 * * * *`, plus `workflow_dispatch` with an optional section id. Reads releases with `GITHUB_TOKEN` and ETag conditional requests (public repos). The lock PR is pushed and opened with the docs-site bot App token, minted in a separate step that runs no repo or content code.

**Which releases count.** Tag matches the section's `release_tag` and the version grammar; published, not a prerelease, `immutable: true`; exactly one asset named `<section>-<version>.docs.zip`. Then:
- (a) same version, higher fix segment: replace that version's bundle;
- (b) version above Latest: add it as the new Latest, only when the product repo has a GA release with the same version;
- (c) newer `release/latest` date tag: replace the bundle;
- (d) a pinned tag whose release was deleted (withdrawn): back to the previous bundle of that version;
- equal or older than the lock: ignored;
- a new version below Latest that the lock lacks: an issue, no PR.
GA check applies to (b) only; not to fixes, `release/latest` or Cloud.

**Verify once, before any content code.** Download into an empty folder; sha256 equals GitHub's digest; `gh attestation verify` (gh >= 2.102.0) with `--repo <content repo>`, `--signer-workflow <docs-site repo>/.github/workflows/docs-bundle.yml@refs/tags/v1`, `--source-ref refs/heads/release/...` matching the tag, `--deny-self-hosted-runners`; safe extraction (yauzl plus own guards); manifest against the JSON Schema and against the lock (section id, `release_tag`). Later fetches (CI, snapshots, Deploy) check only the sha256 recorded in the lock, so old bundles stay valid when `v1` moves.

**Lock vs manifest.** Lock (docs-site owned): `repo`, `release_tag`, `product_repo`, `owners`, `route`, `label`, `former_*`, Cloud entry link. Manifest (team owned): format, `docs:`, `include:`, `nav`, `exclude`, deployment-option defaults. A version entry:
```yaml
- version: 1.2.0
  tag: gateway/v1.2.0.1
  bundle: { asset: api-gateway-1.2.0.1.docs.zip, sha256: <64 hex> }
  source_commit: <40 hex>   # from the manifest, for edit links
  # backfill: true          # generated bundles only
```
`ref`, `sha`, `track`, `sparse`, `mkdocs`, `docs`, `sidebar` and `cloud_companion` `placement` leave the lock.

**Lock PR.** One per section on `bot/bundle-<section>`, updated in place when a newer bundle arrives. The bump-shape required check auto-merges (a), (b), (c) and (d) on green CI; any other lock change (new section, routes, settings, `owners`) still needs the section's owners team. This **supersedes** the delivery map's rule that a promotion needs owners approval: the docs-site owner's merge in the content repo is the approval.

**Failures.** Verification failure: one issue per section and tag on the docs-site repo, label `bundle-intake`, mentioning the section's `owners` team; no PR. CI failure on the lock PR: the PR stays open, plus the same issue. Withdrawal: auto-merging PR to the previous bundle, plus an issue. Link-baseline failures stay blocked until a docs-site owner re-records the baseline in the PR (`snapshots.mjs build <versionId> --record-baseline`).
