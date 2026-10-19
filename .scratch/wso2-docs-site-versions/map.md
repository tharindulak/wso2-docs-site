# Map: All released versions on the WSO2 docs site

Label: wayfinder:map

## Destination

By WSO2Con (2026-11-20), the docs site serves every version published on the current WSO2 docs sites, for each self-hosted distribution. Versions with source are converted from it: docs-repo GitHub releases from now on, release branches or version folders for older versions. Versions with no source stay on Confluence, linked from the version selector under "Older versions" (user decision 2026-10-09). The pipeline is proven on a pilot, then applied to every product, and includes the docs-release convention that product teams adopt. WSO2 Cloud docs stay Latest only. Retiring the current sites is a separate effort.

## Notes

- Domain: documentation platform. Vocabulary lives in [CONTEXT.md](../../CONTEXT.md) (Docs site, Product, Deployment option, Self-hosted distribution, Content source).
- Follows on from [WSO2 docs site on Docusaurus](../wso2-docs-site/map.md). Its out-of-scope line "Older versions of newly migrated products" returns here as a fresh effort.
- Supersedes part of [Versioning details](../wso2-docs-site/issues/08-versioning-details.md): "Latest plus 2 previous" becomes every version published on the current sites (user decision 2026-10-09). Carried over: URL scheme (`/identity/7.2.0/…`), the banner on older versions, missing pages redirecting to the version home, cloud only in Latest, one versioned section per distribution.
- This map builds as well as plans: a pilot, then all products (user decision 2026-10-09).
- Starting facts (survey 2026-10-09): no docs repo publishes GitHub releases yet (docs-is tags are Asgardeo deploy tags). Older versions live in release branches (docs-apim, docs-mi, docs-si, docs-apk, docs-bi, docs-open-banking, docs-integrator), version folders on main (docs-is, docs-api-platform) or Docusaurus `versioned_docs` (docs-agent-platform). Release branches sit among hundreds of noise branches, so versions need an explicit allow-list. Every version together exceeds 25,000 pages (about 6,600 at Latest today).
- From now on, docs versions come from GitHub releases on the docs repos, not branches (user decision 2026-10-09); this map defines the convention.
- Schedule risk: six weeks, alongside the Latest-only migration aimed at the same date. If time runs short, ship the newest versions first; the cut line is in fog.
- Skills every session should consult: grilling, domain-modeling. Research tickets use research; prototype tickets use prototype.
- Supply-chain flag: docs-api-platform's `apim-*` and component branches install `docs-shared-hooks` from a personal fork; raise with the API team before any of those branches is used as a source.
- Follow-up from the pilot: [Fix link conversion for older versions](issues/14-fix-link-conversion-older-versions.md).
- Remaining decisions sit beside execution: [Build the pilot](issues/10-build-the-pilot.md) is the first build ticket.
- Treat findings as planning input for human review; flag security, licensing and supply-chain concerns (fetching many refs, crawling current sites).

## Decisions so far

<!-- one line per closed ticket -->

- [Docusaurus at 40+ versions: build time, memory and snapshot options](issues/04-docusaurus-at-scale.md): one build with every version is not viable (extrapolated 1 to 3.5 h, well over 8 GB); keep Latest plus a few live versions, build frozen versions once as static output under the same URLs, as Docusaurus, Jest and React Native do.
- [Measure conversion of older versions](issues/03-measure-older-version-conversion.md): 12 older versions (6,830 pages) convert at 99.8%, same as Latest; older MkDocs layouts add no failures; one converter fix needed (render Jinja only when a templating plugin is on, for IS 5.9 to 5.11); absolute links to each version's own current site will break on retirement.
- [Inventory every published version and where its source lives](issues/02-version-inventory.md): 51 versions with source (about 23,300 pages) in release branches, folders on main and `versioned_docs`; 22 listed versions have no source and link to Confluence (wso2docs.atlassian.net), not the current sites; Latest mismatches in Kubernetes Gateway, Micro Integrator, API Manager and Financial Services.
- [Choose the Latest source for each section](issues/01-latest-source-per-section.md): Latest is the docs for the newest GA release (release branch or folder until docs releases exist), following post-release fixes; unreleased docs stay off the site; labels come from the lock file; Kubernetes Gateway moves to 1.3.0, Micro Integrator to 4.6.0, API Manager to branch 4.7.0.
- [Docs-release convention for content sources](issues/05-docs-release-convention.md): GA GitHub Releases on docs repos, tagged `v<version>` (or `<component>/v<version>` in multi-component repos), fourth segment for docs fixes (auto-merge), new versions need docs-team approval; existing versions keep branch and folder pins, no backfill; written in `docs-site/CONTENT-RELEASES.md`.
- [Lock file schema for many versions per section](issues/06-lock-file-schema.md): a per-section `versions:` list is the allow-list; Latest is the highest entry and alone tracks fixes; source kind inferred from ref and path; per-version entry point and exclude list; `former_site` template rewrites self-links; `older_versions` lists Confluence links; one file.
- [Build architecture for all versions](issues/07-build-architecture.md): live build holds Latest plus the previous release; every older version is a frozen snapshot (one build per section version) merged under the same URLs, rebuilt when its key changes and stored as a tarball on a GitHub Release; selector reads a runtime `versions.json`; images stored once by content hash.
- [Pick the pilot sections](issues/08-pilot-sections.md): Identity Platform and Micro Integrator, all 14 versions, six pass criteria including a promotion dry run on a fork; live window narrows to Latest only above 60 min or 14 GB; done by 2026-10-23 on branch `docs-site-versions`.
- [Build the pilot](issues/10-build-the-pilot.md): built on `docs-site-versions` (unpushed); Identity and MI all versions in one site, older versions as frozen snapshots; live window narrows to Latest only (34 min, 12 GB heap); criteria 1-4 pass, Faster and the fork release open in [Finish the pilot sign-off](issues/15-finish-pilot-sign-off.md).
- [Rollout order and cut line](issues/13-rollout-order-and-cut-line.md): no cut line; every published version with source now, small sections first, then the API Platform split into per-component sections, then API Manager (biggest versions last, Confluence fallback on out-of-memory); Kubernetes Gateway Latest moves to `1.3.0`, Financial Services stays on `master`. Done 2026-10-12 on branch `docs-site-versions` (not merged): every product's released versions are served; see the ticket's Outcome.
- [Confirm live refs with product teams](issues/09-confirm-live-refs.md): decided by the user without the teams: Kubernetes Gateway ends at 1.3.0; MI Latest moves to branch `4.6.0` and API Manager Latest to branch `4.7.0`; BI and Integrator release branches stay unpublished; EI 7.x linked, not converted; never read the `docs-api-platform` fork-dependent branches.

## Not yet specified

- The [Docs-release convention](issues/05-docs-release-convention.md) changes: with immutable releases, writers run the shared "Publish docs release" workflow instead of publishing a GitHub Release by hand ([Shared release Action](../wso2-docs-rollout/issues/03-shared-release-action.md), 2026-10-14).

- Search scoped by version (waits on the parent map's search decision; snapshots carry version meta tags).

## Out of scope

- [Onboard product teams to docs releases](issues/12-onboard-teams-to-docs-releases.md): moved to [Get product teams to agree to migrate and publish bundles](../wso2-docs-rollout/issues/06-product-team-agreement.md) on the rollout map (2026-10-14).

- Retiring the current docs sites: redirects from old URLs and shutdown (user decision 2026-10-09).
- Versioning WSO2 Cloud docs: cloud stays Latest only.
- Archiving the 22 versions with no source (Identity Server 5.0 to 5.8, API Manager 1.9 to 2.6, Financial Services 1.3 to 2.0): they stay on Confluence, linked under "Older versions" (user decision 2026-10-09).
- Publishing location and hosting (set aside on the parent map).
