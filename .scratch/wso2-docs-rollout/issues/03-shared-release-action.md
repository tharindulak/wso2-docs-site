# Shared release Action

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharindulak
Blocked by: 01

## Question

The reusable GitHub Action (or reusable workflow), owned by the docs-site team, that every content source runs to build, check, attest and attach its bundle per [Docs bundle spec](01-docs-bundle-spec.md). It packs raw MkDocs for unmigrated sources and MDX for migrated ones; attestation must name this workflow so the site can pin `--signer-workflow`. Covers: triggers (a GitHub Release published for `v<version>`, and a path-filtered push with a concurrency group that creates the `cloud/<date.n>` prerelease, per [Cloud Latest without tags](02-cloud-latest-bundles.md)), and the permissions creating releases needs; checks it runs before attaching (MDX compile, HTML and MDX allow-list from [Authored-MDX contract and CI check for docs-is](../../wso2-docs-is-migration/issues/08-authored-mdx-contract.md), component check, version folder matches tag); where the Action and converter live and how they are versioned (repo in the wso2 org, pinned by SHA, Dependabot updates); permissions (`contents: write` on the content source only); and how a failed check is reported to writers.

## Answer

Decided with the user, 2026-10-14.

Facts:
- [Release workflow facts](../research/03-release-action-facts.md):
  - Attestations name the signer workflow only for reusable workflows.
  - Immutable releases lock assets once published, so a `release: published` upload gets 422.
  - Events caused by `GITHUB_TOKEN` start no other workflows.
  - Dependabot updates SHA-pinned reusable workflows.
- The existing `docs-site/check-action` is composite, builds the converter from this repo with `npm ci` (172 packages) and needs no token. No content repo uses it yet.
- `wso2-docs convert` writes a manifest with a `generatedAt` timestamp, so its output is not reproducible yet.

- **Shape:** a reusable workflow (`workflow_call`) in this repo (`Wso2-Cloud`), with semver tags. Each content repo calls it pinned by commit SHA. The site verifies `--signer-workflow` against this repo's workflow path. When the repo moves, that pin moves with it.
- **Cutting a release bundle:** writers run a manual **"Publish docs release"** workflow with a version input.
  - It validates the version and folder first.
  - Then it creates the tag, a draft release, the bundle and its attestation, and publishes.
  - A failed check leaves no tag or release behind.
  - Running it needs repo write access.
  - **This changes the [Docs-release convention](../../wso2-docs-site-versions/issues/05-docs-release-convention.md)** from "publish a GitHub Release" to "run Publish docs release". `docs-site/CONTENT-RELEASES.md` needs rewriting.
  - The bump bot still reads published, non-prerelease releases.
- **Rolling Latest bundles:** a path-filtered push trigger, as in [Cloud Latest without tags](02-cloud-latest-bundles.md), using the default concurrency queue. No `cancel-in-progress`, which can leave orphan drafts.
- **Converter delivery:** built from source in this repo on each run, as `check-action` does today. It is not published to npm and not prebuilt, because the converter is short-lived (every product migrates eventually). The cost of 172 packages and a TypeScript compile on each run is accepted as temporary.
- **Two jobs:**
  - Job 1 builds the bundle and runs the checks with a read-only token, since MDX compiling runs code.
  - Job 2 holds `contents: write`, `id-token: write` and `attestations: write`. It only downloads the checked bundle, attests it, then drafts, uploads and publishes.
  - Each caller grants those permissions at job level.
- **Tags:** rulesets block updates and deletes of `v*` and `cloud/*`, and creation stays open. The site accepts only bundles attested by the shared workflow from a `v*` tag or the default branch. No GitHub App.
- **Updates:** Dependabot (`github-actions`) in each content repo bumps the SHA pin from semver tags. The site checks the signer repo and path, not an exact commit. For security fixes, the site enforces a minimum workflow version read from the manifest.
- **Failures:**
  - Line-level annotations and a run summary on the failed run.
  - A failed rolling bundle publishes nothing, and the site keeps the last good one.
  - GitHub's failed-run email reaches whoever pushed.
- **Check rules:** owned by [Authored-MDX contract and CI check for docs-is](../../wso2-docs-is-migration/issues/08-authored-mdx-contract.md) and the [Docs bundle spec](01-docs-bundle-spec.md) intake rules. The workflow runs the same code as the site.
- **Unverified, testing on hold (user, 2026-10-14):**
  - the signer identity format when callers pin by SHA;
  - whether a draft creates its git tag before publish;
  - whether release creation through the API is checked against tag rulesets.

  All three must be tested in a throwaway repo before the workflow is built (recorded as fog on the map).
