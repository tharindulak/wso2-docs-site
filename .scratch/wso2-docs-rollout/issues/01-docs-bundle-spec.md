# Docs bundle spec

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharindulak
Blocked by:

## Question

What exactly is a [Docs bundle](../../../CONTEXT.md)? Covers: archive format and layout (starting from [Docusaurus tree format decisions](../../wso2-docs-is-migration/issues/12-tree-format-decisions.md): one version's pages, sidebar, `_partials/`, images, `redirects.json`); manifest fields (product, section, version, deployment options, source commit, converter and Action versions, checksum); whether a checksum is enough or the bundle is signed (Sigstore or GitHub artifact attestations); size limits and how shared images by content hash survive per-version bundles; how the lock file schema ([Lock file schema for many versions per section](../../wso2-docs-site-versions/issues/06-lock-file-schema.md)) pins a bundle asset instead of a ref; and what the site rejects on intake (bad checksum, path traversal in the archive, MDX outside the allow-list).

## Answer

Decided with the user, 2026-10-14. Facts: [Bundle delivery facts](../research/01-bundle-delivery-facts.md) (GitHub limits, attestations, safe extraction, prior art); docs-is tree measured at fork `2dcedd3c8`; current pull code read on `docs-site-search` and `docs-is-migrate`.

- **Scope:** one bundle per docs release = one version of one section (for example Identity Server `v7.3.0`). Source only (MDX or MkDocs, sidebars, images, partials, `redirects.json`); never rendered HTML.
- **Every content source publishes bundles**, migrated or not. An unmigrated source's bundle carries its **raw MkDocs** source; the docs site converts it at build time, so converter fixes and new components reach every unmigrated product without a release. A migrated source's bundle carries MDX. The shared Action runs the conversion check before publishing either way.
- **Migration becomes optional per product** (revises the charting decision "every product migrates"): Identity Platform now; others where it pays (cloud and self-hosted merged content, teams wanting explicit components). The converter stays a long-lived product owned by the docs-site team.
  - *Clarified 2026-10-14 in [Shared release Action](03-shared-release-action.md):* "optional" means no forced deadline. Every product migrates eventually, and the converter is short-lived.
- **Images:** each bundle is self-contained with every image its version references (docs-is: Latest ~406 MB tar.gz, older 100 to 260 MB; GitHub limit 2 GiB per asset). The site stores images once by content hash on intake. The Action warns on images over 1 MB.
- **Format:** reproducible tar.gz (sorted entries, fixed mtime and owner).
- **Trust:**
  - The lock file pins the asset's SHA-256, checked after download. A checksum inside the manifest proves nothing.
  - A GitHub artifact attestation is verified with the shared Action's workflow pinned (`--signer-workflow`), so only the shared Action produces an accepted bundle.
  - Immutable releases are switched on for each content repo.
  - All 22 repos the lock file references are public (checked 2026-10-14), so attestations are free everywhere and no checksum-only fallback is needed.
- **Intake rules:** any failure blocks the bump PR, with no fallback. The shared Action runs the same checks before publishing.
  - Extract with node-tar into a fresh directory. Reject links, absolute paths and paths that climb out of the folder. Cap file count, file size and decompression ratio.
  - JSON sidebars only; no `.js` or `.ts` sidebars.
  - Apply the MDX allow-list plugin and the HTML allow-list to all bundle content (today neither runs on `docusaurus` sources).
  - Allow iframes only from listed hosts.
  - Allow non-doc files (`.jar`, `.zip`, `.car`, `.sh`, `.wsdl`, `.html` templates) only under `downloads/` with listed extensions. They are served as downloads, never rendered.
- **Manifest (`bundle.json`):** format version, product, section, version, deployment options, content kind (`mkdocs` or `mdx`), source repo and commit, Action and converter versions, page and asset counts.
- **Lock entry:** `bundle: {repo, tag, asset, sha256}` beside `ref`/`sha`, replacing them for bundle-delivered versions. The 51 existing older versions keep git pins. The site checks that the manifest matches the lock entry and the attestation's commit.
