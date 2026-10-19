# 01 Docs bundle delivery: facts (researched 2026-10-14)

Input for the Docs bundle design: each product docs repo CI attaches a versioned bundle archive to a GitHub Release; the central site's lock file pins it and its CI downloads and extracts it. Bundles are untrusted input to the site build.

All sources accessed 2026-10-14. **[unverified]** marks facts not confirmed in a primary source. "Implication" lines are suggestions for review, not decisions.

## TL;DR

- Release assets: under 2 GiB each, up to 1000 per release, no total size or bandwidth limit. Public assets download without auth. GitHub computes a SHA-256 `digest` per asset (assets uploaded after June 2025 only).
- **Immutable releases are GA** (since 2025-10-28): assets and tag locked after publish, plus an automatic Sigstore release attestation. Enable per repo or org. Verify with `gh release verify-asset`.
- **Artifact attestations** (`actions/attest`, `gh attestation verify`) prove repo + workflow + ref + commit. Free for public repos on all plans; private/internal repos need GitHub Enterprise Cloud. SLSA Build L2 (L3 with a reusable workflow).
- **node-tar** (v7.5.22) is hardened by default against traversal, absolute paths, link escapes and device files, and has `maxDecompressionRatio` (default 1000). Its README still says: reject all links with a `filter`, cap file sizes, use `strict`, extract into a fresh directory.
- tar.gz is the safe default format: universal tooling, gzip in Node core, reproducible recipe well documented. zstd is on runners and in node-tar 7.5, but Node's zstd API is still experimental.
- `GITHUB_TOKEN` is scoped to its own repo and limited to 1,000 REST requests/hour/repo. The central CI cannot use it to read private product repos.

## 1. GitHub Release assets

| Fact | Source |
|---|---|
| "Up to 1000 release assets may be associated with a single release. Each file included in a release must be under 2 GiB. There is no limit on the total size of a release, nor bandwidth usage." | https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases |
| GitHub computes a SHA-256 digest for every uploaded release asset, "generated at upload time, immutable". The digest appears in the UI, the REST `digest` field, GraphQL `ReleaseAsset`, and `gh release view`. (Changelog dated 2025-06-03.) | https://github.blog/changelog/2025-06-03-releases-now-expose-digests-for-release-assets/ |
| Observed: assets uploaded before that change return `digest: null` (for example, `cli/cli` v2.60.0). Implication: do not rely on `digest` for old releases. | Test against `https://api.github.com/repos/cli/cli/releases/tags/v2.60.0`, 2026-10-14 |
| Same-name upload to a release returns an error. Users with push access can edit (rename or relabel) and delete assets on a mutable release. | https://docs.github.com/en/rest/releases/assets |
| **Immutable releases**: "the assets and associated Git tag cannot be changed after publication". Title and notes stay editable. | https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases |
| GA on 2025-10-28 (public preview from 2025-08-26). Enabled at repo or org level, and applies to new releases only: "Existing releases remain mutable unless you republish them." Immutable releases get signed release attestations in Sigstore bundle format. | https://github.blog/changelog/2025-10-28-immutable-releases-are-now-generally-available/ |
| GHES 3.20 has immutable releases, but release attestations are GitHub.com only. **[unverified: search snippet only]** | https://github.blog/changelog/2026-03-17-github-enterprise-server-3-20-is-now-generally-available/ |
| Plan availability of immutable releases is not stated on the pages read. **[unverified]** | (none) |
| Verify a release: `gh release verify TAG`. Verify a local file against a release asset: `gh release verify-asset TAG PATH`. Run these from the repo that contains the release. Auto-generated source zip/tarball cannot be verified. | https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/verifying-the-integrity-of-a-release |
| Immutability blocks adding assets after publish. Implication: CI should create a draft release, upload all assets, then publish. **[unverified: inferred from "can't be added"; draft-then-publish flow not confirmed]** | GA changelog above |
| List assets: `GET /repos/{owner}/{repo}/releases/{release_id}/assets` (max 100 per page). Get one asset: `GET /repos/{owner}/{repo}/releases/assets/{asset_id}`. For the binary, send `Accept: application/octet-stream`. "API clients should handle both a 200 or 302 response." The response also includes `browser_download_url`. | https://docs.github.com/en/rest/releases/assets |
| CLI: `gh release download [<tag>] --pattern GLOB --dir DIR`. | `gh release download --help` (gh CLI) |
| Public repos: observed that `browser_download_url` downloads with no auth (302 to `release-assets.githubusercontent.com`, then 200). Implication: allow that host in any egress allow-list. | Test against `https://github.com/cli/cli/releases/download/v2.60.0/gh_2.60.0_checksums.txt`, 2026-10-14 |
| Private repos need a token with read access to the repo. The exact fine-grained permission ("Contents: read") was not shown in the docs extract. **[unverified]** | https://docs.github.com/en/rest/releases/assets |
| `GITHUB_TOKEN`: "The token's permissions are limited to the repository that contains your workflow." For other repos, use a GitHub App installation token or a PAT. Lifetime is up to 6 h on hosted runners. | https://docs.github.com/en/actions/concepts/security/github_token ; https://docs.github.com/en/actions/tutorials/authenticate-with-github_token |
| Rate limits: unauthenticated 60/h; PAT 5,000/h; `GITHUB_TOKEN` 1,000/h per repo (15,000/h per repo for Enterprise Cloud resources). Secondary limits: 100 concurrent requests, 900 REST points/min, 80 content-creating requests/min, 500/h. | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api |
| Whether the redirected blob download counts against the REST rate limit. **[unverified]** | (none) |

Implication: about 16 products × a few assets per build is far below every limit. The real constraint is private repos, which need an App token in the central CI.

## 2. Provenance: attestations vs checksum vs cosign

| Fact | Source |
|---|---|
| An artifact attestation records the workflow link, repository, organization, environment, commit SHA and triggering event. "The attestations must be verified for the benefit to be realized." | https://docs.github.com/en/actions/concepts/security/artifact-attestations |
| Public repos use the Sigstore public-good instance, which writes to a public immutable transparency log. Private repos use GitHub's own Sigstore instance, which has no transparency log. | same |
| "Artifact attestations by itself provides SLSA v1.0 Build Level 2". Build L3 needs a reusable workflow that isolates the build. | same; levels at https://slsa.dev/spec/v1.0/levels (page marked retired; v1.2 is current) |
| Availability: public repos on Free, Pro and Team. "To use artifact attestations in private or internal repositories, you must be on a GitHub Enterprise Cloud plan." No separate cost is stated beyond the plan. | https://github.com/actions/attest-build-provenance |
| `actions/attest-build-provenance` v4 is now a wrapper; "new implementations should use `actions/attest` instead." Required job permissions: `id-token: write`, `contents: read`, `attestations: write`. Step: `uses: actions/attest@v4` with `subject-path`. | https://github.com/actions/attest-build-provenance ; https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations |
| Verify: `gh attestation verify FILE -R owner/repo`. Tighter policy flags: `--signer-workflow`, `--signer-repo` (required when a reusable workflow signed), `--source-ref`, `--source-digest`, `--cert-identity`, `--deny-self-hosted-runners`, `--predicate-type`. `--bundle` supports offline verification. Default predicate is `https://slsa.dev/provenance/v1`, default OIDC issuer is `https://token.actions.githubusercontent.com`. Only `signature.certificate` and `verifiedTimestamps` resist tampering by the workflow, so treat `statement.predicate` as user-controlled. | https://cli.github.com/manual/gh_attestation_verify |
| cosign keyless: Fulcio issues a short-lived certificate tied to an OIDC identity, and Rekor logs the signing event. `cosign sign-blob FILE --bundle X.sigstore.json`; `cosign verify-blob FILE --bundle X.sigstore.json --certificate-identity=... --certificate-oidc-issuer=...`. | https://docs.sigstore.dev/cosign/signing/overview/ ; https://docs.sigstore.dev/cosign/signing/signing_with_blobs/ ; https://docs.sigstore.dev/cosign/verifying/verify/ |
| GitHub attestations use the Sigstore bundle format and can be verified with other Sigstore tools. | GA changelog (section 1) |

Comparison (analysis, not sourced):

| Option | Proves | Gaps |
|---|---|---|
| SHA-256 in central lock file | The bytes are the ones pinned at lock time (trust on first use) | Says nothing about who built them. A checksum inside the bundle's own manifest proves nothing, since an attacker can rewrite both. |
| GitHub `digest` plus immutable release | Asset unchanged since publish; tag locked | Does not prove which workflow built it. A repo admin could publish a hand-made asset. |
| Artifact attestation | Built by workflow W in repo R at ref/commit C on GitHub-hosted runners | Private repos need GHEC. Verifier must pin `--signer-workflow` and `--source-ref`, or the check is weak. |
| cosign keyless | Same identity binding, portable outside GitHub | Extra tool (cosign is not listed on ubuntu-24.04 runners) and more to configure, for little gain over `gh attestation` on GitHub. |

## 3. Safe extraction of untrusted archives (Node.js CI)

| Fact | Source |
|---|---|
| Zip Slip is a directory traversal through entries like `../../evil.sh`. It affects tar, jar, war, cpio, apk, rar and 7z, not just zip. Fix: validate that each entry resolves inside the target directory. | https://security.snyk.io/research/zip-slip-vulnerability |
| Path traversal "aims to access files and directories that are stored outside the web root folder". | https://community.owasp.org/attacks/Path_Traversal |
| OWASP: apply size limits "after file decompression"; zip bombs are an availability threat. The cheat sheet does not cover entry counts or symlinks. | https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html |
| node-tar default hardening (disabled when `preservePaths: true`): entries walking outside the target are ignored with a warning; links may not target outside the folder; no extraction through a symlink inside the target; absolute paths made relative; char/block devices and FIFOs never extracted; ownership not changed unless `forceChown` or root; modes ignored unless `chmod: true`; Unicode normalized. | https://github.com/isaacs/node-tar (README "Security Information") |
| node-tar warnings: never extract into a folder an unknown actor could control (TOCTOU). Use a `filter` that "rejects all hardlinks and symbolic links". Filter out excessively large files in compressed archives. Stay on the latest version. | same |
| Options: `strict` (warnings become errors, default false), `filter(path, entry)`, `maxDepth` (default 1024), `maxDecompressionRatio` (default 1000), `unlink`, `preservePaths` (must stay false). Confirmed present in published `tar@7.5.22` (`dist/esm/options.d.ts`). | same; npm registry `tar` latest = 7.5.22 |
| Node `zlib` convenience methods take `maxOutputLength`, which does not apply to streams. Zstd in zlib was "Added in: v23.8.0, v22.15.0", "Stability: 1 - Experimental". | https://nodejs.org/api/zlib.html |
| The same Node page mentions a zip reader with `maxSize`. Version and stability not confirmed. **[unverified]** | https://nodejs.org/api/zlib.html |

Suggested extraction policy (for review):

1. Download the asset to a fresh temp directory and check the pinned SHA-256 and attestation **before** opening it.
2. Extract with node-tar into a new, empty directory that nothing else writes to. Use `strict: true`, `preservePaths: false`, no `chmod`, default `maxDecompressionRatio`.
3. In the `filter`, allow only `File` and `Directory` entries. Reject `SymbolicLink`, `Link` and anything else.
4. Also in the filter: enforce an allow-list of extensions (`.mdx`, `.md`, `.json`, `.yml`, images), a per-file size cap, a running total-bytes cap and a max entry count. Fail on violation rather than skip.
5. After extraction, re-walk the tree with `lstat`, assert no links and every `realpath` is under the root, then validate `manifest` and `redirects.json` against a schema.
6. Treat MDX as code. MDX compiles to JS that runs at build time, so the site's MDX/HTML policy (see `docs-converter` `html-policy.ts`) is the real content trust boundary. (Analysis.)

## 4. Archive format

| Fact | Source |
|---|---|
| ubuntu-24.04 runner image includes `tar 1.35`, `zstd 1.5.7`, `pigz 2.8`, `zip 3.0`, `unzip 6.0`, `p7zip`, `gh 2.102.0`. cosign is not listed. | https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md |
| node-tar creates and reads gzip, brotli (7.x) and zstd (added in 7.5) tarballs. Its zstd path depends on Node zlib zstd, which is experimental (v22.15+/v23.8+). | https://github.com/isaacs/node-tar/blob/main/CHANGELOG.md ; https://nodejs.org/api/zlib.html |
| Reproducible tar: `--sort=name`, `--mtime=@$SOURCE_DATE_EPOCH` (`--clamp-mtime`), `--owner=0 --group=0 --numeric-owner`, drop atime/ctime PAX fields, fixed `--mode`, `gzip -n`. Reproducible zip: reset mtimes and use `zip -X`. `git archive` output is not guaranteed deterministic. | https://reproducible-builds.org/docs/archives/ |
| node-tar `portable` omits system-specific metadata, and `mtime` forces a fixed time, so a Node-side packer can be deterministic. | https://github.com/isaacs/node-tar |
| PNG/JPEG/WebP are already compressed, so the outer codec mostly affects text (MDX, JSON). zstd vs gzip size and speed on a real bundle has not been measured. **[unverified]** | (none) |
| zip has no maintained zero-dependency reader in stable Node core, so a zip bundle would need a third-party library. **[unverified]** | (none) |

Implication: tar.gz built with node-tar (`portable`, fixed `mtime`, sorted input) is the lowest-risk default. Revisit zstd once Node marks it stable.

## 5. Prior art

| System | How content arrives | Source |
|---|---|---|
| Antora | Content sources are **git repos** (URL plus branch/tag filters) fetched by the playbook, with private repo auth supported. Only the **UI bundle** is a zip archive fetched by URL, cached by URL signature, with `snapshot` to refresh. Example points at a GitLab job artifact. | https://docs.antora.org/antora/latest/playbook/content-source-url/ ; https://docs.antora.org/antora/latest/playbook/ui-bundle-url/ |
| Docusaurus multi-instance | One `plugin-content-docs` instance per section (`id`, `path`, `routeBasePath`, `sidebarPath`), each with its own `[id]_versions.json` and versioned folders. Every build rebuilds all instances, and Docusaurus advises separate sites for very large instances. Not documented: loading content from outside the site directory. | https://docusaurus.io/docs/docs-multi-instance |
| Backstage TechDocs | Recommended setup: each repo's CI builds its docs and publishes the output to cloud storage, and the portal reads from storage. Closest analogue to "CI publishes a bundle, aggregator consumes it". | https://backstage.io/docs/features/techdocs/architecture |
| Kubernetes website | Uses a git submodule for the reference-docs generator (`kubernetes-sigs/reference-docs`) and Go modules. API reference is generated from source, not consumed as release artifacts. **[unverified beyond `.gitmodules`/`go.mod`]** | https://github.com/kubernetes/website/blob/main/.gitmodules |

## 6. Reusable Actions supply-chain guidance

| Fact | Source |
|---|---|
| "Pin references to actions to a commit SHA". Tags "can be moved or deleted if a bad actor gains access". Take the SHA from the action's own repo, not a fork. | https://docs.github.com/en/actions/reference/security/secure-use |
| Workflow dependency lockfiles (`gh extension install github/gh-actions-lock`; `gh actions-lock`) record exact commits and verify source repo identity. "Supersedes SHA pinning for repositories that adopt it." **Public preview.** Reusable workflow dependencies are covered by the lockfile of the repo that defines them. | same; https://docs.github.com/en/actions/how-tos/secure-your-work/lock-workflow-dependencies |
| Org/enterprise policy "Require actions to be pinned to a full-length commit SHA" (since 2025-08-15) fails unpinned workflows. Reusable workflows can still be referenced by tag. The REST field is `sha_pinning_required`. | https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/ |
| Set the default `GITHUB_TOKEN` to read-only and raise permissions per job. Avoid `pull_request_target`, and never check out untrusted code in it. Pass untrusted context through env vars, not inline `${{ }}`. Dependabot does not alert on SHA-pinned actions. | https://docs.github.com/en/actions/reference/security/secure-use |
| Workflow execution protections GA on 2026-09-17. A default rule disabling `pull_request_target` on public repos is enforced from 2026-11-02. **[unverified: search snippet only]** | https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/ |
| OpenSSF Scorecard checks. **Token-Permissions**: top-level `read-all` or `contents: read`, writes at job level. **Pinned-Dependencies**: pin by hash. **Dangerous-Workflow**: no untrusted checkout in `pull_request_target`/`workflow_run`, no script injection. **Signed-Releases**: counts `*.sigstore.json`, `*.sig`, `*.asc`, `*.intoto.jsonl` assets (10 points with SLSA provenance) but "does not verify the signatures". Also Branch-Protection and Dependency-Update-Tool. | https://github.com/ossf/scorecard/blob/main/docs/checks.md |

Implication: in the product-side reusable workflow, give the publish job `contents: write`, the attest step `id-token: write` and `attestations: write`, and everything else `contents: read`. Pin all actions by SHA (or lockfile), and have callers pin the reusable workflow by SHA so `--signer-workflow` checks a known version.

## Open / unverified

- Plan availability of immutable releases and release attestations (GHEC vs Team) for private repos.
- Exact fine-grained token permission to download private release assets, and whether asset downloads count against REST rate limits.
- Whether all ~16 WSO2 docs repos are public. If any are private, attestations need GHEC and the central CI needs an App token.
- Measured zstd vs gzip size and time on a real bundle.
