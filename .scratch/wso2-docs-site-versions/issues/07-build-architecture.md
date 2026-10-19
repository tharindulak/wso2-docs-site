# Build architecture for all versions

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharinduj
Blocked by: 03, 04

## Question

Given the conversion results for older versions and Docusaurus's scale limits, how is the site built with every version: all versions in one Docusaurus build, older versions built once as frozen static output, or split sites? When is a frozen version rebuilt (converter or theme change, content fix), where does its output live, and how do images avoid being copied per version?

## Answer

Decided with the user, 2026-10-09. Builds on [Docusaurus at 40+ versions](04-docusaurus-at-scale.md) and [Measure conversion of older versions](03-measure-older-version-conversion.md).

- **Shape:**
  - The live Docusaurus build holds recent versions.
  - Every older version is a frozen snapshot, built once into static output and merged into the deploy under the same URLs (`/identity/7.2.0/…`).
  - There are no separate sites.
- **Live window:** Latest plus the previous release for each section (user chose this over Latest only). The previous release stays pinned, as the [lock file schema](06-lock-file-schema.md) says. On promotion, the former previous release becomes a snapshot.
  - Risk: the live build roughly doubles in pages, to about 12,000. Camunda needed about 22 GB for about 9,700 files.
  - Measure this in the pilot, and re-test Docusaurus Faster (`future.v4`) there.
- **Version selector:**
  - The live build publishes `/<route>/versions.json`: every version, its status (live, snapshot or Confluence) and its page routes.
  - Live and snapshot pages fetch it at runtime. The selector keeps the reader on the same page when that page exists in the target version, and otherwise opens the version's home.
  - Snapshot entries use full page loads (`pathname://`).
- **Snapshot unit:**
  - One Docusaurus build per section version (for example `integration-mi@4.4.0`), about 49 builds.
  - They run in parallel as a CI matrix and are rebuilt independently.
- **Rebuilds:**
  - A snapshot's key hashes its source commit, exclude list, converter version and site chrome version.
  - Any change to the key rebuilds that snapshot, including chrome changes (user chose this over a weekly chrome rebuild).
  - Cost: every theme or header commit rebuilds every snapshot. Keep chrome commits batched, and watch CI minutes.
- **Storage:**
  - One tarball per snapshot, named by its key, attached to a GitHub Release on the docs-site repo.
  - It sits behind a small storage interface, so it can move to the chosen host's object storage once hosting is decided.
- **Images:** stored once by content hash under `/assets/img/<hash>.<ext>`, with image references rewritten by the converter, so identical images across versions share one file.
- **Links:**
  - Each snapshot is link-checked when it is built.
  - After merging, a small in-house script checks internal links across the whole output, with no new dependency.
  - Links from live pages into snapshots use `pathname://`.
- **Search:** not decided here. Snapshots carry the same version meta tags as live pages, so any index can filter by version later.
