# Build the reusable bundle workflow

Parent: [map](../map.md)
Type: task (AFK, HITL for the fork run)
Status: open
Assignee: tharindulak
Blocked by: 05

## Question

Build what [Reusable bundle workflow spec](05-reusable-bundle-workflow-spec.md) decided, on branch `feat/docs-bundle-workflow` cut from `docs-site-build`: the docs manifest (converter config accepting `section` and `nav`, JSON Schema), `wso2-docs manifest init`, a `wso2-docs bundle` command (resolve section from branch, check, deterministic zip, report), the reusable `.github/workflows/docs-bundle.yml` (`workflow_call`; check-only on pull requests), the onboarding setup script and checklist. Executable-content rule starts strict (reject `.ts`/`.js` sidebars and config) until [Executable content in bundles](10-executable-content-in-bundles.md) decides. Prove it on `tharindulak/docs-api-platform` with API Gateway 1.2.0 as a prerelease, then clean up after the user confirms.

## Progress

2026-10-27, branch `feat/docs-bundle-workflow` (pushed to `tharindulak/wso2-docs-site`): `837b795` (code, docs, script), `cf7f4a4` (workflow pins the converter at `837b795`).

Built:
- `wso2-docs.yaml` gains `section` and `nav` (`src/manifest.ts`, validated; `nav` replaces the sidebars file for Docusaurus sources); JSON Schema `packages/docs-converter/schema/wso2-docs.schema.json`, kept in step by a test.
- `wso2-docs bundle` (`src/bundle.ts`, `src/zip.ts`): branch to section, next tag, check, missing nav pages, references outside the section, symlinks, code files, 200 MB / 20,000-file limits, deterministic zip, sha256, `bundle.json`; `--check-only`.
- `wso2-docs manifest init` (from a sidebars `.json`; keeps labels).
- `.github/workflows/docs-bundle.yml` (reusable): `check` on pull requests, `publish` on pushes.
- `docs-site/scripts/setup-content-repo.sh` (dry run unless `--apply`), `docs-site/DOCS-BUNDLES.md`, README pointers.
- Tests: converter 309 → 334, all pass; scripts and site 143 pass with `DOCS_SITE_TEST_OWNER=tharindulak` (as CI sets it). shellcheck and actionlint clean.

Proof on `tharindulak/docs-api-platform` (caller at `@feat/docs-bundle-workflow`, no `v1` tag yet):
- `release/gateway/1.2.0` from `0718908` plus `f6a644b` (caller and the `manifest init` output: 58 pages, 59 labels). Push run 40500723996: `bundle / publish` passed, `bundle / check` skipped. Release `gateway/v1.2.0` "API Gateway 1.2.0", not a prerelease, generated notes, asset `api-platform-api-gateway-1.2.0.docs.zip` (75 files, sha256 `402bf503…3328`, matching GitHub's digest).
- Attestation verifies with `--signer-workflow tharindulak/wso2-docs-site/.github/workflows/docs-bundle.yml --source-ref refs/heads/release/gateway/1.2.0 --deny-self-hosted-runners` (signer `…/docs-bundle.yml@refs/heads/feat/docs-bundle-workflow`); pinning the content repo's caller file is rejected.
- Deterministic: a local `wso2-docs bundle` of the same commit gives the same sha256. 73 content files byte-identical to `0718908`; `redirects.json` holds only `current` (575 entries); `wso2-docs.yaml` at the root carries `source_commit`.
- PR #1 (`proof/bundle-check` into the release branch): `bundle / check` passed (58 pages, 0 new failures), `bundle / publish` skipped, no release made. Not merged (a fix release would wake the docs-site repo's hourly bump bot).
- `setup-content-repo.sh` dry run: listed immutable releases and the two branch rulesets, skipped the tag ruleset (user-owned), flagged direct admin `tharindulak`; changed nothing.

Not yet proven: `setup-content-repo.sh --apply` (the rulesets' payloads, including the repository-admin bypass on a user-owned repo); the `v1` tag; mkdocs-kind sections (bundles support `kind: docusaurus` only; mkdocs manifests and `manifest init` for mkdocs are follow-ups).

Open: cleanup of the proof (release and tag `gateway/v1.2.0`, branches `release/gateway/1.2.0` and `proof/bundle-check`, PR #1), after the user confirms.
