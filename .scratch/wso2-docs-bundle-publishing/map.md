# Map: Publishing docs from docs bundles

Label: wayfinder:map

## Destination

A build-ready spec, handed off for implementation, for publishing docs from docs bundles: the content-repo release flow (branch, review gate, reusable bundle workflow), the docs-site intake (30-minute poll, verification, lock PR that auto-merges, GA check), the changes to Deploy (a GitHub Release on the docs-site repo for every deploy, target 141 only), and cutover from git pins to bundles for every section. Done when nothing is left to decide.

## Notes

- Domain: documentation platform delivery. Vocabulary lives in [CONTEXT.md](../../CONTEXT.md): use Docs site, Content source, Product, Section, **Docs bundle** (added 2026-10-27). A team's "product" in this effort means one section of the lock (AI Gateway, API Gateway, API Portal, API Manager are sections of API Platform).
- Builds on the [WSO2 docs site on Docusaurus](../wso2-docs-site/map.md) map, the delivery map "Deploying, previewing and migrating the docs site with GitHub workflows" (`.scratch/wso2-docs-site-delivery/map.md` in the `plan-docs-site-delivery` worktree), `docs-site/README.md` and `docs-site/CONTENT-RELEASES.md`. Its Deploy, snapshots, bot App and fork decisions stand unless a ticket here changes them.
- Planning only: tickets produce decisions, not workflows. Building them is handed off.
- Skills every session should consult: grilling, domain-modeling. Research tickets use research.
- Charting decisions (user, 2026-10-27):
  - **One docs bundle per section per version**, attached to a GitHub Release on the content source. Zip-only: after cutover no section is fetched from git, including Latest.
  - **Bundle holds source content**, not built HTML. MkDocs today, Docusaurus after a section's migration cutover; content a team has already converted may be used as is. The docs site keeps conversion, theme, navigation, search and link checks.
  - **Review gate lives in the content repo**: a product team's PR to a release branch is approved and merged by a docs-site owner with write access; that merge publishes the bundle. From there the docs site needs no person: poll, verify, lock PR, build, deploy.
  - **Branches**: one per version (`release/<component>/<major.minor.patch>`, or `release/<version>` in single-distribution repos), docs fixes from the same branch as fourth-segment tags (`v1.2.0.1`). Sections with no versions (hub, Updates, Security, cloud-only products, separate cloud repos) release from `release/latest` with date tags (`cloud/v2026.10.27`); cloud content that shares a source with self-hosted ships in the Latest bundle (refined by the bundle layout ticket). Today's tag prefixes stay.
  - **Reusable bundle workflow** shipped by the docs site (next to `check-action`): check, pack, manifest, publish.
  - **Intake**: poll content repos every 30 minutes plus manual dispatch; no tokens in content repos. A new bundle becomes an **auto-merging lock PR** (fix releases and new versions alike; the docs-team approval PR goes away). The **product GA check stays**: a new version waits until the product repo has a matching GA release.
  - **Deploy**: unchanged triggers; every deploy also creates a GitHub Release on the docs-site repo recording what went live. Target the 141 VM only, never 129.
  - **Rollback**: a section's content can go back to its previous bundle, and the whole site can go back to a previous deploy.
  - **Existing versions**: bundles generated once from today's pinned SHAs, kept in a docs-site bundle store and marked backfill, so snapshots can still rebuild on theme or converter changes. A team's later release for that version replaces the backfill.
  - **Home**: as the delivery map: built and tested in the user's forks and the 141 VM; moving to the wso2 org is a later effort.
- Treat findings as planning input for human review; flag security, supply-chain and cost concerns (bundles are untrusted input).

## Decisions so far

<!-- one line per closed ticket -->

- [Where the build assumes git sources](issues/01-where-the-build-assumes-git.md): 26 git assumptions; the lock needs repo, tag, asset and sha256 per version, the manifest repo-relative paths, edit branch and commit; shared repos and tree-wide Docusaurus assets complicate one-bundle-per-version; `.ts`/`.js` sidebars run code in the deploy job.
- [GitHub releases, attestations and safe zip intake](issues/02-releases-attestations-and-safe-zip-intake.md): immutable releases plus sha256 digests and `actions/attest` provenance verified with gh >= 2.102.0; content repo's own token can publish if workflow files match the default branch; polling is cheap but the lock PR needs the App token; ruleset plus CODEOWNERS gate; yauzl with own guards for zip intake.
- [Docs bundle layout and manifest](issues/03-docs-bundle-layout-and-manifest.md): `wso2-docs.yaml` per section (identity plus YAML navigation of pages with optional labels, categories, links) replaces mkdocs nav and sidebars; self-contained `<section>-<version>.docs.zip`; Cloud is the first, default switcher entry, taken from the Latest bundle (or a separate cloud repo's bundle), with deployment-option markers deciding each view.
- [Content-repo release flow](issues/04-content-repo-release-flow.md): writers on `main`, docs-site owners cut `release/**` branches; every push publishes (branch = `vX.Y.Z`, merges = fix segments, date tags on `release/latest`); one docs-site owner approval plus required check; tag ruleset; revert PR or emergency delete; caller workflow pinned to `@v1`, identical on all branches.
- [Release facts on the forks](issues/11-release-facts-on-the-forks.md): immutable releases and cross-repo reads with `GITHUB_TOKEN` work on user repos; the workflow-file mismatch rejection did not reproduce; Actions cannot bypass a tag ruleset on user repos, so forks use no tag ruleset and rely on attestation; wso2 org plan and roles unknown.
- [Rehearse a bundle release on the API Platform fork](issues/12-rehearse-a-bundle-release-on-the-api-platform-fork.md): API Gateway 1.2.0 released as a prerelease bundle; check, attestation and byte-identical contents all held; navigation page items may carry a `label`; rehearsal cleaned up.
- [Reusable bundle workflow spec](issues/05-reusable-bundle-workflow-spec.md): docs-site `docs-bundle.yml` at a moving `v1` (converter pinned inside), a 10-line no-input caller added once by a docs-site owner; check-only on PRs, publish on push; deterministic zip, 200 MB / 20,000 files; one manifest per `release_tag` prefix; `.github/**` and manifests on `main` gated; AI Workspace prefix becomes `ai-workspace/v`.
- [Docs-site intake spec](issues/06-docs-site-intake-spec.md): poll at :07 and :37; verify digest, attestation (signer `docs-bundle.yml@v1`), immutability, safe zip and manifest once, then trust the lock's sha256; new lock version shape; one auto-merging PR per section for fixes, new versions after GA, `release/latest` and withdrawals (supersedes promotion approval); failures become `bundle-intake` issues; link-baseline failures stay blocked.

## Not yet specified

- Content repos that hold several sections (docs-api-platform's components and cloud tree, Identity's merged cloud and self-hosted pages, `cloud_companion` placement): whether one release can carry several bundles, and how a companion's bundle lines up with the version it is merged into. Sharpens once the bundle layout and release flow are decided.
- How `CONTENT-RELEASES.md`, the `wso2-docs check` PR action and the retired content bump and promotion workflows are wound down during cutover (intake replaces the two workflows).
- How a docs bundle digest enters snapshot keys and link baselines (bundles are deterministic, so a byte-identical release has the same digest).
- Repeated intake failures for one section (issue noise, when to stop retrying).

## Out of scope

- Rendering the Cloud entry on the site (version switcher, per-view filtering, search scope for the Cloud view): a docs-site change, recorded on the [WSO2 docs site on Docusaurus](../wso2-docs-site/map.md) map; this map only makes bundles carry what it needs.

- Previews of content-repo PRs or of a bundle before release: wanted later, not now (user decision 2026-10-27).
- Moving to the wso2 org, the `production` environment, more environments, VM access for others, monitoring and alerts: the delivery map's follow-up effort "Taking the docs site workflows to production".
- Changes to the MkDocs-to-Docusaurus migration workflow, beyond the bundle recording its content format (user decision 2026-10-27).
- Any deploy to the 129 VM.
- Building the workflows themselves: this map ends at the spec.
