# Release facts on the forks

Parent: [map](../map.md)
Type: task (AFK where possible, HITL for org facts)
Status: closed
Assignee: tharindulak
Blocked by:

## Question

Settle four facts the bundle workflow and intake specs wait on, by trying them on the user's forks (`tharindulak/*`) with a throwaway repo and release, and by asking the user for the org facts:

1. Can immutable releases be turned on for user-owned public repos?
2. Can the docs-site repo's `GITHUB_TOKEN` read other public repos' releases, asset digests and attestations (or is the bot App token needed)?
3. Does the "workflow files must match the default branch" rejection also apply when a tag is pushed and a release created from a release branch?
4. Can a tag ruleset on release tags (`*v*`, `*/v*`) give GitHub Actions (the repo's `GITHUB_TOKEN`) a bypass so only the release workflow can create tags? (from [Content-repo release flow](04-content-repo-release-flow.md))
5. (HITL) Is the `wso2` org on GitHub Enterprise Cloud, and what roles do product teams hold on their docs repos (admin or not)?

Record what was done and each result; delete the throwaway repo afterwards after confirming with the user.

## Progress

2026-10-27:
- Fact 5 (wso2 org plan and product-team roles): **unknown** (user). Ask the wso2 GitHub org owners before the org move; affects only the out-of-scope move to the wso2 org (Required reviewers needs teams; private-repo attestations need Enterprise Cloud; admins can bypass rulesets).
- Facts 1 to 4: spike files prepared (README, `mode`, one workflow) for a throwaway public repo `tharindulak/docs-bundle-release-spike`; creating the repo was blocked by the permission check and awaits the user's go-ahead. Local gh is 2.96.0 (below the 2.102.0 pin); the spike verifies attestations on GitHub runners.

## Resolution

Done 2026-10-27 on a throwaway public repo `tharindulak/docs-bundle-release-spike` (README, `mode`, one workflow; dummy zip, no docs content). Runs 40477593350, 40477593633, 40477593251, 40477593411 (release/1.0.0 to 4.0.0) and one for release/5.0.0; runner gh 2.102.0. Repo deletion: pending the user granting the `delete_repo` scope (`gh auth refresh -h github.com -s delete_repo`).

1. **Immutable releases on user-owned repos: yes.** `PUT /repos/{owner}/{repo}/immutable-releases` returned 204; every release published from a draft came out `immutable: true` with a sha256 `digest` on its asset. Intake can require `immutable: true` on the forks too; no test-only switch needed.
2. **`GITHUB_TOKEN` reads other public repos: yes.** A `contents: read` job read `tharindulak/docs-api-platform` releases, read `cli/cli` attestations by digest, and `gh attestation verify --repo cli/cli` passed. Polling public content repos needs no App token; the lock PR still does.
3. **Workflow-file mismatch rejection: not reproduced.** Branches whose `.github/workflows/release.yml` differed from `main` created and published releases with the repo's own token, both with the tag created by the Releases API and with the tag pushed first by `git push`. The research's documented rule did not bite here; [Reusable bundle workflow spec](05-reusable-bundle-workflow-spec.md) may drop or keep the identical-files check (it is cheap) but must not rely on GitHub enforcing it.
4. **Tag ruleset with a GitHub Actions bypass on user-owned repos: no.** The API rejects it: "Actor GitHub Actions integration must be part of the ruleset source or owner organization" (422). A tag ruleset with no bypass blocks both a hand-pushed tag by the repo owner (GH013) and the workflow's release publish (422, "Repository rule violations"). So on the forks there is **no tag ruleset**; intake's attestation check is the gate. In the wso2 org an Actions bypass may be accepted (untested; ask with fact 5).
   - Extra: our own bundle verified with `--signer-workflow <repo>/.github/workflows/release.yml --source-ref refs/heads/release/2.0.0 --deny-self-hosted-runners`, and failed with `--source-ref refs/heads/main`, so signer and branch pinning work. Local gh 2.96.0 was used for this functional check only; pin >= 2.102.0 in CI.
5. **wso2 org plan and product-team roles: unknown** (user). Ask the wso2 GitHub org owners before the org move.
