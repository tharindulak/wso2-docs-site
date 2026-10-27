# Docs bundle layout and manifest

Parent: [map](../map.md)
Type: grilling (HITL)
Status: closed
Assignee: tharindulak
Blocked by: 01

## Question

Decide what a docs bundle contains and how it describes itself: the folder layout inside the zip, which files outside the section folder come along (includes, shared images, `mkdocs.yml`), the manifest fields (section id, version, tag, content format `mkdocs` or `docusaurus`, source commit, converter check version, file list or digest), the asset name, and how a bundle of content already converted to Docusaurus is told apart and used without conversion.

Inputs from [Where the build assumes git sources](01-where-the-build-assumes-git.md): migrated Docusaurus trees share `assets/` (1.0 GB in docs-is), `static/`, `redirects.json` and `versions.json` across versions, so decide between duplicating them per bundle and a separate shared-assets bundle; and one section built from two repos (Integrator+Devant, API Manager+Bijira).

## Resolution

Decided with the user, 2026-10-27 (Q20 to Q37). Builds on [Where the build assumes git sources](01-where-the-build-assumes-git.md) and [GitHub releases, attestations and safe zip intake](02-releases-attestations-and-safe-zip-intake.md).

**Docs manifest.** One file per section, `wso2-docs.yaml` in the section's root folder; each release branch carries only the manifest of the section it releases. Two parts:
- `section`: section id, version, content format (`mkdocs` or `docusaurus`; content already converted is used as is), optional `include:` (repo-relative folders to pack besides the section folder).
- `nav`: the section's navigation.

Plain YAML, validated against a JSON Schema the docs site publishes, by the reusable workflow and again at intake. Executable sidebars (`.ts`/`.js`) are not accepted. The manifest **replaces** `mkdocs.yml` `nav:` and Docusaurus `sidebars.*` for the docs site; a one-time `wso2-docs manifest init` generates it from a repo's current nav or sidebar.

**Navigation items:** page (by repo-relative path; shows the page title or front matter `sidebar_label`), category (required `label`, optional overview page, `collapsed` flag), external link (https). No label overrides on pages, no auto-generated folders. Deployment options stay in page front matter, not in the navigation. A fix release may change its version's navigation.

**Bundle.** One per section version, one asset per release: `<section>-<version>.docs.zip` (for example `ai-gateway-1.2.0.1.docs.zip`). The zip keeps repo-relative paths and has `wso2-docs.yaml` at its root; the reusable workflow adds the sha256 and source commit, writers never edit them. Each bundle is self-contained: the workflow packs only the assets its pages reference (no shared-assets bundle). `wso2-docs check` fails any reference outside the bundle.

**Cloud entry** (overrides the docs-site map's "no toggle" and "Latest = Cloud + newest self-hosted"; recorded there):
- The version switcher lists **Cloud** first, selected by default, then the self-hosted versions (Identity Platform: Cloud · 7.2.0 (Latest) · 7.1.0 · …). Cloud-only products show Cloud only; self-hosted-only products show versions only.
- Where cloud and self-hosted share one source, Cloud comes from the **Latest bundle**: a cloud edit merges into Latest's release branch and ships as a fix release (`v7.2.0.1`). When a new version becomes Latest, Cloud moves with it; older versions keep no cloud content.
- Where the cloud docs live in another repo (Devant beside WSO2 Integrator, Bijira beside API Manager), the cloud repo keeps its own bundle released from `release/latest` with date tags, and the lock marks it as the Cloud entry of its section. `cloud_companion` placement maps leave the lock.
- The existing deployment-option markers (front matter `deployment:` with section default, labelled one-option blocks) decide what each view shows: the Cloud view drops self-hosted-only pages and blocks, a version view drops cloud-only ones. One navigation serves both views; an entry whose page is hidden disappears from that view.
- `release/latest` is used only by sections with no versions (hub, Updates, Security, cloud-only products and separate cloud repos).

Effects on other tickets: executable sidebars are removed from [Executable content in bundles](10-executable-content-in-bundles.md) (MDX and MkDocs config remain); the lock entry shape in [Docs-site intake spec](06-docs-site-intake-spec.md) must carry the Cloud entry link and drop `placement`.

**Amended 2026-10-27 (user, after [Rehearse a bundle release on the API Platform fork](12-rehearse-a-bundle-release-on-the-api-platform-fork.md)):** a page item may carry an optional `label`, shown in the sidebar instead of the page title (48 of API Gateway 1.2.0's 58 entries use a short label). Without it the page title or front matter `sidebar_label` is used. `manifest init` copies existing sidebar labels into `label`. The converter config already named `wso2-docs.yaml` (`kind`, `route`, `docs`, `sidebar`, `deployment_options`) is the file the docs manifest extends with `section` and `nav`.
