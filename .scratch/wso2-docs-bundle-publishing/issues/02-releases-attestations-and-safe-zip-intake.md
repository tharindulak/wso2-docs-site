# GitHub releases, attestations and safe zip intake

Parent: [map](../map.md)
Type: research (AFK)
Status: closed
Assignee: tharindulak
Blocked by: 

## Question

Gather the facts the bundle workflow and intake depend on, from GitHub docs and primary sources: release asset size and count limits; immutable releases and whether assets can be replaced after publish; artifact attestations (`actions/attest-build-provenance`, `gh attestation verify`) and how to pin the signer to a repo, workflow file and ref; REST and GraphQL rate limits for polling about 25 repos every 30 minutes with `GITHUB_TOKEN` versus a GitHub App; whether a reusable workflow called from a content repo can publish a release with that repo's own `GITHUB_TOKEN`; branch protection, rulesets and CODEOWNERS that require a reviewer from outside the repo's team on `release/**` branches; safe zip extraction in Node 22 (zip slip, symlinks, size and file-count bombs) with a maintained, licence-compatible library.

## Resolution

Researched 2026-10-27. Findings: [research/02-releases-attestations-and-safe-zip-intake.md](../research/02-releases-attestations-and-safe-zip-intake.md) on branch `research/02-releases-attestations-and-safe-zip-intake` (commit `d2b3558`).

- **Releases:** up to 1000 assets per release, each under 2 GiB; GitHub records a sha256 `digest` per asset. Immutable releases lock assets and tag once published; the release can still be deleted and its tag name is never reusable. Intake should require `immutable: true` and treat a deleted release as withdrawn. GitHub's release attestation does not name the building workflow, so build provenance is still needed.
- **Attestations:** `actions/attest@v4` (MIT). Public repos on all plans; private repos need Enterprise Cloud. Verify with `gh attestation verify --repo <content> --signer-workflow <docs-site path>@<ref> --source-ref refs/heads/release/... --deny-self-hosted-runners`, without `--signer-repo`. Pin gh >= 2.102.0 (GHSA-wjmr-j3rp-mh2g, GHSA-4mq3-hpgx-9cx8: prefix and case-insensitive matching before that).
- **Reusable workflow:** can publish with the content repo's `GITHUB_TOKEN`; caller job needs `contents: write`, `id-token: write`, `attestations: write`. The Releases API rejects `GITHUB_TOKEN` when the target commit's `.github/workflows/` differs from the default branch, so the caller file must be identical on every release branch.
- **Polling:** about 70 to 140 requests an hour, well inside limits; authorised 304s are free. The lock PR needs the bot App token (PRs from `GITHUB_TOKEN` do not trigger checks, so they never auto-merge).
- **Review gate:** forks: ruleset on `release/**/*` plus CODEOWNERS ("Required reviewers" teams are org-only). wso2 org: "Required reviewers" with a docs-site owners team. Both: restrict who creates release branches (CODEOWNERS is read from the base branch); product teams must not be repo admins.
- **Zip intake:** yauzl 3.4.x (MIT) plus own guards (symlinks and modes, duplicate and case-colliding names, count, size and ratio caps, `O_EXCL|O_NOFOLLOW` writes, verify before parsing). Avoid adm-zip (nine advisories). Node 22 EOL 2027-04-30.
- **Flags:** MDX and MkDocs config can run code at build (added to [Executable content in bundles](10-executable-content-in-bundles.md)); the reusable workflow must run no content-repo code before packing and attesting. Open spikes ticketed as [Release facts on the forks](11-release-facts-on-the-forks.md).
