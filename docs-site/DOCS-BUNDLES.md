# Docs bundles

How a product team publishes a version of its docs to the docs site as a docs bundle: a zip holding one section's source content at one version, attached to a GitHub Release on the content repo. Decisions are in the planning map `.scratch/wso2-docs-bundle-publishing/map.md`. The docs site's side (intake, lock, deploy) is not built yet; until it is, sections keep the git pins described in `CONTENT-RELEASES.md`.

## The flow

1. Writers work on `main`, the next unreleased version.
2. When a version is ready, a docs-site owner creates its release branch from `main`: `release/<component>/<x.y.z>` (for example `release/gateway/1.2.0`), or `release/<x.y.z>` in a repo with one distribution. Sections with no versions (the hub, cloud-only products, separate cloud repos) use `release/latest`.
3. Creating the branch publishes the version: tag `<component>/v<x.y.z>`, asset `<section id>-<x.y.z>.docs.zip`.
4. Fixes to a released version are pull requests straight into its branch. A docs-site owner approves and merges; each merge publishes the next fix release (`gateway/v1.2.0.1`, `.2`, …). Carrying a fix forward to `main` is the team's job.
5. `release/latest` releases are dated: `cloud/v2026.10.27`, then `.1`, `.2` the same day.

Every pull request to a release branch runs the same check the release runs (`bundle / check`), so what passes review is what publishes. A release is immutable: to undo one, merge a revert (a new fix release). In an emergency a docs-site owner deletes the release; its tag name can never be reused, so numbering continues.

## The docs manifest

Each section has one `wso2-docs.yaml` in its root folder: the converter config (`kind`, `route`, `docs`, `deployment_options`, …, see `packages/docs-converter/README.md`) plus `section` and `nav`. Only `kind: docusaurus` sections can be bundled for now.

```yaml
kind: docusaurus
route: api-platform/api-gateway
deployment_options: [Self-hosted]
docs: docusaurus/api-gateway/docs          # this version's pages (older versions: versioned_docs/version-<x.y.z>)
redirects: { file: docusaurus/api-gateway/redirects.json, version: current }   # optional; only this key is bundled
section:
  id: api-platform-api-gateway              # the section id in the docs site's lock file
  label: API Gateway                        # release titles: "API Gateway 1.2.0.1"
  version: 1.2.0                            # must equal the release branch's version (latest on release/latest)
  release_tag: gateway/v                    # v, or <component>/v with one path segment
  include: [shared/snippets]                # optional: other folders pages may reference
nav:
  - page: docusaurus/api-gateway/docs/overview.mdx
    label: Overview                         # optional: shown instead of the page title
  - category: Setup
    collapsed: false                        # optional
    overview: docusaurus/api-gateway/docs/setup/index.mdx   # optional page for the category itself
    items:
      - page: docusaurus/api-gateway/docs/setup/configuration.mdx
  - link: https://example.com/reference
    label: API reference
```

The navigation is plain data and replaces `sidebars.*` (a sidebar written as `.ts` or `.js` is not read). Deployment options stay in page front matter. Generate the first manifest from an existing sidebars `.json` file:

```sh
npx wso2-docs manifest init --config docusaurus/api-gateway/wso2-docs.yaml \
  --id api-platform-api-gateway --label "API Gateway" --prefix gateway/v --section-version 1.2.0 --write
```

## What a bundle holds, and what stops it

The bundle is self-contained and deterministic (the same content always gives the same sha256): the pages under `docs`, the files they reference inside the section folder or an `include` folder, the version's own redirects, and `wso2-docs.yaml` at the zip's root with `section.source_commit` added. Paths inside the zip are repo-relative.

`wso2-docs bundle` fails, and nothing is published, when:

- the manifest is invalid, or `section.version` is not the branch's version;
- a navigation page does not exist under `docs`;
- `wso2-docs check` finds a new failure (`exclude` still lists known failures, and may only shrink);
- a page references a file outside the section folder and its `include` folders;
- the bundle would hold a symbolic link or a code file (`.js`, `.ts`, `.mjs`, …), or the navigation comes from a code sidebar;
- it exceeds 200 MB or 20,000 files.

Run it locally before opening a pull request:

```sh
npx wso2-docs bundle --branch release/gateway/1.2.0 --check-only
```

## Onboarding a repo (docs-site owner)

1. Open a pull request to the content repo's `main` with:
   - `.github/workflows/docs-bundle.yml`, the caller (identical in every repo; release branches inherit it):
     ```yaml
     name: docs bundle
     on:
       push: { branches: ['release/**'] }
       pull_request: { branches: ['release/**'] }
     permissions: {}
     jobs:
       bundle:
         uses: tharindulak/wso2-docs-site/.github/workflows/docs-bundle.yml@v1
         permissions: { contents: write, id-token: write, attestations: write }
     ```
   - the section's `wso2-docs.yaml` from `manifest init`;
   - `.github/CODEOWNERS` naming the docs-site owners for `*` (release branches) and for `.github/**` and `**/wso2-docs.yaml`.
2. Apply the repo settings (admin rights needed; prints the changes first):
   ```sh
   docs-site/scripts/setup-content-repo.sh <owner>/<repo>            # dry run
   docs-site/scripts/setup-content-repo.sh <owner>/<repo> --apply
   ```
   It turns on immutable releases, adds a ruleset requiring a reviewed pull request (code owner approval, `bundle / check` green, no force pushes) on `release/**/*`, and limits creating and deleting release branches to repo admins. In an organization it also blocks hand-made release tags (GitHub Actions bypasses); on user-owned repos it cannot, and the docs site's attestation check is the gate.
3. Check what the script reports and cannot fix: product teams hold write, not admin (admins can bypass rulesets). In the wso2 organization, prefer the ruleset's Required reviewers rule with a docs-site owners team; it is not available on user-owned repos.

## How the docs site trusts a bundle

The reusable workflow (`.github/workflows/docs-bundle.yml` in this repository) runs only this repository's converter, at the commit pinned in the file, and signs a provenance attestation for the zip. The docs site accepts a bundle only from an immutable, non-prerelease release whose asset digest matches and whose attestation names that workflow at `refs/tags/v1` and the release branch as its source ref (`gh attestation verify`, gh 2.102.0 or later).
