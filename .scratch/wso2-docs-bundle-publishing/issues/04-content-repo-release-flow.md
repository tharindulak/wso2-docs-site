# Content-repo release flow

Parent: [map](../map.md)
Type: grilling (HITL)
Status: closed
Assignee: tharindulak
Blocked by: 02

## Question

Specify the flow in a content repo from writer to published bundle: branch names (per version, `release/latest`), how the next tag is chosen (new version, fourth-segment fix, date tag), the review gate (docs-site owner with write access approves and merges; CODEOWNERS, rulesets), what starts the bundle publish (merge to a release branch), and what a team does to withdraw a bad release.

Inputs from [Docs bundle layout and manifest](03-docs-bundle-layout-and-manifest.md): cloud edits on shared sources merge into Latest's release branch as fix releases; `release/latest` only for sections with no versions; the manifest lives in the section's root folder on each release branch.

## Resolution

Decided with the user, 2026-10-27 (Q38 to Q44). Builds on [GitHub releases, attestations and safe zip intake](02-releases-attestations-and-safe-zip-intake.md) and [Docs bundle layout and manifest](03-docs-bundle-layout-and-manifest.md).

**Branches.**
- `main` holds the next, unreleased version; writers work there.
- A docs-site owner creates `release/<component>/<x.y.z>` (or `release/<x.y.z>`) from `main` when the version is ready. Only docs-site owners may create, delete or force-push `release/**/*` (branch ruleset), because CODEOWNERS is read from the base branch.
- Fixes to a released version are PRs straight into its branch; carrying a fix forward to `main` is the team's job.
- `release/latest` for sections with no versions; cloud edits on shared sources go to Latest's branch.

**What publishes.** Every push to a release branch. Creating the branch publishes `<prefix>v<x.y.z>`; each later merge publishes the next fourth segment (`v7.3.0.1`, `v7.3.0.2`). The version comes from the branch name; the workflow fails when the manifest's version differs. One run per branch at a time (concurrency group). No re-runs with the same tag: immutable tags are never reused. Creating the branch before the product GA is safe: intake holds a new version until the GA exists.

**`release/latest` tags.** `<prefix>v<YYYY.MM.DD>` for the first release of the day, then `<prefix>v<YYYY.MM.DD>.1`, `.2`.

**Tags.** A tag ruleset blocks creating, moving or deleting release tags by hand; only the workflow makes them (Actions bypass to be confirmed in [Release facts on the forks](11-release-facts-on-the-forks.md)). Intake's attestation check (our workflow, `refs/heads/release/...`) stays the real gate.

**Review gate.** One docs-site owner approval on PRs to `release/**/*`; the product team's own review is optional. `main` needs no docs-site approval (nothing on `main` goes live). Required status check: `wso2-docs check`. Product teams hold write, not admin.
- Forks: branch ruleset plus CODEOWNERS `* @tharindulak`.
- wso2 org: the ruleset's Required reviewers rule with a `docs-site-owners` team.

**Withdrawing a bad release.**
- Normal: a revert PR to the release branch, which publishes a new fix release.
- Emergency: a docs-site owner deletes the release; intake treats it as withdrawn and pins the section's previous bundle (mechanics in [Deploy release record and rollback](08-deploy-release-record-and-rollback.md)). The tag name is never reused; numbering continues.

**Caller workflow.** A tiny `.github/workflows/` caller, identical on `main` and every release branch (GitHub rejects the repo token otherwise), calling the reusable workflow at a protected major tag (`@v1`). The reusable workflow checks the files match and fails with a clear message. Moving to `@v2` means one PR per open release branch, merged by a docs-site owner.
