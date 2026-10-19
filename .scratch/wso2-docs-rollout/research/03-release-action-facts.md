# 03 Shared release mechanism: facts (researched 2026-10-14)

Input for the shared GitHub mechanism that about 16 public `wso2` docs repos run to build the docs bundle (tar.gz), run checks, attest it, and attach it to a GitHub Release. There are two flows:

1. A human releases `v<version>`.
2. A push to the default branch that touches cloud paths makes the workflow create the prerelease `cloud/<yyyy.mm.dd.n>`.

Immutable releases are on. The site verifies with `gh attestation verify --signer-workflow`.

This note builds on `01-bundle-delivery-facts.md` and does not repeat it. That note already covers asset limits, immutable release basics, `actions/attest` permissions, the SHA pinning policy and lockfiles, and the Scorecard checks.

All sources were accessed on 2026-10-14. **[unverified]** marks items not confirmed in a primary source. "Implication" lines are suggestions for review, not decisions.

## TL;DR

- **Use a reusable workflow (`workflow_call`), not a composite action.** Fulcio puts `job_workflow_ref` into the certificate SAN. For a reusable workflow that is the shared workflow file. A composite action runs as a step in the caller's job, so the signer would be each product repo's own workflow. `--signer-workflow` matches against the SAN.
- **An immutable release is locked at publish, and that includes adding assets.** `release: published` followed by an upload fails. The bundle must be attached while the release is still a draft, or in the create call itself. Draft releases fire no `created` workflow event.
- **Flow 1 must be redesigned.** "Human clicks Publish, then CI attaches the bundle" cannot work. Options are a tag push, `workflow_dispatch`, or a human-made draft that CI publishes (details in section 2).
- **Flow 2 works as planned.** A release created with `GITHUB_TOKEN` triggers no other workflow, which is fine because the same run creates the draft, uploads, attests and publishes.
- **The caller job grants the permissions.** The reusable workflow can only reduce them: `contents: write`, `id-token: write`, `attestations: write`.
- **Tag rulesets with "Restrict creations" can gate `v*` and `cloud/*`.** Letting `GITHUB_TOKEN` bypass them is not reliably supported. A GitHub App is the documented bypass actor type. **[partly unverified]**
- **Dependabot and Renovate both update SHA-pinned remote reusable workflows.** The shared repo needs tags for this to be clean.

## 1. Composite action vs reusable workflow: signer identity

| Fact | Source |
|---|---|
| OIDC claim `job_workflow_ref`: "For jobs using a reusable workflow, the ref path to the reusable workflow." Example: `octo-org/octo-automation/.github/workflows/oidc.yml@refs/heads/main`. `workflow_ref`: "The ref path to the workflow" (the top-level caller). | https://docs.github.com/en/actions/reference/security/oidc |
| Fulcio (GitHub Actions): "`job_workflow_ref` is included as a SAN URI: `https://github.com/{job_workflow_ref}`". | https://github.com/sigstore/fulcio/blob/main/docs/oidc.md |
| Fulcio extensions: Build Signer URI (OID 1.3.6.1.4.1.57264.1.9) = `server_url + job_workflow_ref`, described as "build instructions that are responsible for signing". Build Config URI (OID 1.3.6.1.4.1.57264.1.18) = `server_url + workflow_ref`, the "top-level/initiating build instructions". Source Repository URI = `server_url + repository`. | https://github.com/sigstore/fulcio/blob/main/docs/oid-info.md |
| The signing workflow "will always be the workflow that uses the" attest action, "which may be a reusable workflow". The attestation is fetched from the caller repo (`-o`/`-R`). If the reusable workflow is in another repo, use `--signer-repo` or `--signer-workflow`. The page states that reusable workflows plus attestations "help you achieve SLSA v1.0 Build Level 3". Both caller and reusable workflow need the permissions. | https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/increase-security-rating |
| `gh attestation verify`: if the attestation came from a reusable workflow, "that reusable workflow is the signer whose identity needs to be validated", and you "must use either `--signer-workflow` or `--signer-repo`". | https://cli.github.com/manual/gh_attestation_verify |
| gh source: `--signer-workflow` becomes a SAN regex `^https://<host>/<owner>/<repo>/<path>` with an anchored optional `@(refs/.*\|<hex sha>)` suffix, so `release.yml.attacker.yml` cannot match `release.yml`. A value that already contains `@ref` must match exactly. `--signer-repo` becomes the case-insensitive prefix `^https://github.com/<owner>/<repo>/`. If neither is set, the SAN must start with the `-R` repo or `-o` owner, so a cross-repo reusable-workflow attestation fails `-R product-repo` alone. `--signer-digest` matches the Build Signer Digest extension, and `--source-ref` and `--source-digest` match the source extensions. | https://github.com/cli/cli/blob/b473ca8c43eb96fa88bbc4cfefe6afbac0560f80/pkg/cmd/attestation/verify/policy.go |
| Composite actions "run as a step within a job" and do not contain jobs. Reusable workflows are "called directly within a job, not from a step". | https://docs.github.com/en/actions/concepts/workflows-and-actions/reusing-workflow-configurations |
| A composite action leaves `job_workflow_ref` set to the caller's own workflow, so the signer is the product repo's workflow. **[inferred: no source states this for composite actions explicitly]** | Analysis of the rows above |

Implication: put the build, check, attest and upload steps in one reusable workflow, for example `wso2/<shared>/.github/workflows/docs-release.yml`. The site then verifies with:

```
gh attestation verify bundle.tar.gz -R wso2/<product> \
  --signer-workflow wso2/<shared>/.github/workflows/docs-release.yml \
  --source-ref refs/tags/v1.2.3 --deny-self-hosted-runners
```

`--signer-digest <sha>` can also pin the exact shared-workflow commit. That matches the SHA pinning plan, but every shared-workflow bump then needs a site change too.

When the caller pins by SHA, the SAN suffix is probably `@<sha>`. gh's regex explicitly accepts "a bare object ID" as the ref. **[unverified: not tested against a real certificate]**

## 2. Immutable releases and asset upload

| Fact | Source |
|---|---|
| "Once you publish a release as immutable, its assets can't be added, modified, or deleted." Tags "can't be deleted or moved". | https://github.blog/changelog/2025-10-28-immutable-releases-are-now-generally-available/ |
| Recommended order: "Create the release as a draft", "Attach all associated assets to the draft release", "Publish the draft release". The title, notes, and prerelease/latest flags stay editable after publish. | https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases |
| "Workflows are not triggered for the `created`, `edited`, or `deleted` activity types for draft releases." | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows |
| Projects that switched report that uploading after `release: published` returns HTTP 422 "Cannot upload assets to an immutable release". A prerelease counts as published. The common fix is draft, then upload, then publish, or passing the assets in the same `gh release create` call. **[secondary sources: project issues, not GitHub docs]** | https://github.com/WisewareOrg/WiseKiosk/issues/418 ; https://github.com/dryvist/cc-edge-pack-template/issues/45 ; https://github.com/exoma-ch/nucl-parquet/issues/429 |
| REST: setting `draft: false` "publishes the release". `target_commitish` is "Unused if the Git tag already exists". The page does not say whether a draft creates the git tag before publish. **[unverified: tag timing for drafts]** | https://docs.github.com/en/rest/releases/releases |
| Immutable releases get a signed release attestation covering the tag, commit and assets at publish. Its predicate type and signer identity were not found on the pages read. It is separate from the `actions/attest` build provenance and does not replace `--signer-workflow`. **[unverified: predicate and signer details]** | Immutable releases page above |

Implication for flow 1. "A human publishes `v1.2.3`, then CI attaches the bundle" is impossible. These options work instead:

- (a) The human pushes tag `v1.2.3`, or creates it through a ruleset-gated path. `on: push: tags: ['v*']` builds the bundle, runs `gh release create v1.2.3 --draft`, uploads, attests, and publishes. A `--verify-tag` style check is sensible.
- (b) `workflow_dispatch` with a version input, using the same steps.
- (c) The human creates a draft and then dispatches the workflow, which uploads to the draft and publishes. Draft creation itself fires no event.

Option (a) or (b) keeps the human's action to one step. Path filters are not evaluated for tag pushes (section 3), so the tag workflow always runs. Note also: "Events will not be created for tags when more than three tags are pushed at once."

## 3. Triggers, path filters, concurrency

| Fact | Source |
|---|---|
| "events triggered by the `GITHUB_TOKEN` will not create a new workflow run". Exceptions are `workflow_dispatch` and `repository_dispatch`, plus gated `pull_request` runs. The reason is to prevent recursive runs. | https://docs.github.com/en/actions/concepts/security/github_token |
| `release` types: `published`, `unpublished`, `created`, `edited`, `deleted`, `prereleased`, `released`. "The `prereleased` type will not trigger for pre-releases published from draft releases, but the `published` type will trigger." Use `published` to cover both stable releases and prereleases. `GITHUB_REF` = `refs/tags/<tag_name>`. | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows |
| `branches` together with `paths` means both must match. "Path filters are not evaluated for pushes of tags." A push with more than 1,000 commits, or a timed-out diff, always runs. Only the first 3,000 changed files are considered. | same ; https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax |
| Concurrency allows at most one running and, by default, one pending run per group; a new pending run cancels the older pending one. `cancel-in-progress: true` also cancels the running one. `queue: max` allows up to 100 pending runs and cannot be combined with `cancel-in-progress`. | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax |
| Do not use the same `concurrency.group` in the caller and the called workflow. With `cancel-in-progress: true` the called workflow can cancel the caller. | https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations |

Implications:

- Flow 2 needs no second workflow. A `cloud/*` release published by `GITHUB_TOKEN` will not re-trigger anything, including the `release: published` workflow.
- For collapsing bursts, use `concurrency: { group: docs-cloud-${{ github.repository }}, cancel-in-progress: false }`. The default single-pending queue already collapses a burst to "current plus latest".
- Avoid `cancel-in-progress: true` here. A run cancelled between "create draft" and "publish" leaves an orphan draft, or a half-uploaded draft that the next run must clean up or reuse. Choose the `.n` counter so that a leftover draft does not collide with the next tag. (Analysis.)

## 4. Permissions and cross-repo use

| Fact | Source |
|---|---|
| "The GITHUB_TOKEN permissions passed from the caller workflow can be only downgraded (not elevated) by the called workflow." The `github` context "is always associated with the caller workflow". | https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations |
| Permission keys include `contents`, `id-token`, `attestations` and `artifact-metadata`. "If you specify the access for any of these permissions, all of those that are not specified are set to `none`." | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax |
| OIDC: if the reusable workflow is in the same org or enterprise as the caller, the token is available. If it is outside the org, `id-token: write` must be set "explicitly at the caller workflow or job level". | https://docs.github.com/en/actions/reference/security/oidc |
| A called workflow in a public repo is usable if "your organization allows you to use public reusable workflows". Private and internal called repos need the Access policy on the called repo. | https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations |
| Org policy "Allow OWNER, and select non-OWNER, actions and reusable workflows" takes patterns `OWNER/REPOSITORY/PATH/FILENAME@TAG-OR-SHA` with `*` wildcards, `!` to block, and at most 1000 entries. The restricted default token is read for `contents` and `packages`. | https://docs.github.com/en/organizations/managing-organization-settings/disabling-or-limiting-github-actions-for-your-organization |
| The "Require … pinned to a full-length commit SHA" policy does not cover reusable workflows: "Reusable workflows can still be referenced by tag." | same |
| Call syntax is `{owner}/{repo}/.github/workflows/{filename}@{ref}`, where ref can be a SHA, tag or branch. "Using the commit SHA is the safest option." Limits: 10 levels, 50 unique reusable workflows per file, no subdirectories. | https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows ; reusing-workflow-configurations above |

Implication: each product repo's caller job declares `permissions: { contents: write, id-token: write, attestations: write }` and has the form `uses: wso2/<shared>/.github/workflows/docs-release.yml@<sha> # vX.Y.Z`. Because the shared repo is in the `wso2` org, the "owner" org policy already allows it. SHA pinning of reusable workflows must be enforced by review or a lint, since the org policy does not enforce it.

## 5. Restricting who creates `v*` and `cloud/*` tags

| Fact | Source |
|---|---|
| Tag rulesets target tags by `fnmatch` pattern. "Restrict creations": "only users with bypass permissions can create branches or tags whose name matches the pattern". "Restrict updates" and "Restrict deletions" work the same way. | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets ; https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository |
| Bypass actors (REST `actor_type`): `Integration`, `OrganizationAdmin`, `RepositoryRole`, `Team`, `DeployKey`, `User`. Modes: `always`, `pull_request`, `exempt`. | https://docs.github.com/en/rest/repos/rules |
| The docs do not say whether the built-in GitHub Actions app (`GITHUB_TOKEN`) can be a bypass actor. Community reports conflict: some say the API rejects integration 15368 with HTTP 422. **[unverified]** | https://github.com/voyager163/liftoff/issues/83 ; https://github.com/firemanxbr/omarchy-pool/issues/351 |
| Whether creating a release through the API (which creates the tag) is evaluated against tag rulesets is not stated. **[unverified]** | (none found) |

Implication: test this in a sandbox repo before relying on it.

- If `GITHUB_TOKEN` cannot bypass, flow 2 needs a GitHub App token (an `Integration` bypass actor) to create `cloud/*` tags. That adds a secret per repo or org, and that secret becomes a target.
- A lighter option is to leave `cloud/*` unrestricted for creation but restricted for update and delete. Immutable releases already lock the tag after publish.
- Then let the site accept only bundles whose attestation shows `--signer-workflow` = the shared workflow and `--source-ref refs/heads/<default>`. A hand-pushed `cloud/*` tag then cannot produce an accepted bundle.
- For `v*`, restrict creation to a release-managers team.

## 6. Keeping 16 callers up to date

| Fact | Source |
|---|---|
| Dependabot version updates support "versioned reusable workflows", pinned "either by commit SHA or by tag" (changelog 2023-03-13). | https://github.blog/changelog/2023-03-13-dependabot-updates-support-reusable-workflows-for-github-actions/ |
| Dependabot `github-actions`: it supports `owner/repo@<tag>` and `@<commit>`. If the commit has no tag, it updates to the latest commit. It updates a version comment on the same line. Local `./.github/...` reusable workflows are ignored. | https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories |
| Renovate gives reusable-workflow calls the depType `workflow`. It updates a pinned SHA "according to the GitHub tag you specified" in the comment. Bare SHAs without a comment are disabled by default. `helpers:pinGitHubActionDigests` pins digests automatically. | https://docs.renovatebot.com/modules/manager/github-actions/ |

Implication:

- Tag the shared workflow repo with semver releases.
- Callers pin `@<sha> # vX.Y.Z` and run Dependabot (`github-actions`, weekly, grouped). That gives 16 PRs per bump, each needing a human merge.
- Renovate is an alternative if WSO2 already runs it. It can be set org-wide through a shared preset.

## Open / unverified

- The SAN suffix format when the caller pins the reusable workflow by SHA: `@<sha>` vs `@refs/...`. Confirm on a real attestation.
- Whether the git tag exists while a release is a draft, and whether API release creation is evaluated against tag rulesets.
- Whether `GITHUB_TOKEN` (the GitHub Actions app) can be a ruleset bypass actor in an org repo.
- The release attestation's predicate type and signer, and its relation to `gh attestation verify`.
- Whether `queue: max` and other recent concurrency options are GA.
