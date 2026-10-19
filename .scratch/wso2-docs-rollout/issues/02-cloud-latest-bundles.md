# Cloud Latest without tags

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharindulak
Blocked by:

## Question

WSO2 Cloud content is Latest only, changes continuously and is not tagged under the [Docs-release convention](../../wso2-docs-site-versions/issues/05-docs-release-convention.md). How does it produce bundles once a product migrates: a rolling bundle on every merge to main, a scheduled one, or a moving `cloud` release? How does that interact with Latest being cloud merged with the newest self-hosted release in one unified page set, and with auto-merge on a green build? Who approves cloud changes reaching the site?

## Answer

Decided with the user, 2026-10-14. Facts:
- Cloud change rate over 90 days: Asgardeo about 22 merges, Choreo 6, Devant 1. Bursts of 11 to 32 commits a day, during working hours in Sri Lanka.
- Today the bump bot moves `track` pins hourly and auto-merges on a green build.
- Unmigrated sections merge cloud and self-hosted page by page in one site build (`merge.ts`).
- The migrated docs-is `docs/` is already the merged Latest.

- **Two bundle streams per section.** Self-hosted versions get **release bundles** (`v<version>`, per the [Docs-release convention](../../wso2-docs-site-versions/issues/05-docs-release-convention.md)). Cloud content gets a **rolling Latest bundle**, cut from the tracked branch. What goes in it:
  - **Unmigrated merged sections** (Identity, Integrator with Devant, API Manager with Bijira): the cloud MkDocs tree or companion repo only. The site merges it with the newest self-hosted release bundle, as it does today.
  - **Cloud-only and single-source repos** (Choreo, API Platform, Security): the whole tracked tree.
  - **Migrated merged sections** (Identity Platform after cutover): the unified `docs/`.
- **Publishing.** Each rolling bundle is a new immutable GitHub Release with a unique prerelease tag, `cloud/<yyyy.mm.dd.n>` (or `<component>/cloud/…`). It gets the same SHA-256 pin, attestation and intake checks as any bundle. The bump bot treats the `cloud/` prefix as rolling Latest and never as a GA product version. Expected volume is about 100 releases a year per busy repo.
- **Trigger.** A push to the tracked branch that touches the section's cloud paths, filtered by path. A concurrency group keeps only the newest run during bursts. The site's hourly bump picks it up.
- **Approval.** Rolling bundles auto-merge on a green site build. The human gate is the PR review in the content repo. Docs-team approval stays only for new self-hosted versions.
- **Migrated merged sections.** Whatever is on the tracked branch is live. Writers prepare the next self-hosted version on a release branch and merge it at GA. The `v<version>` release then marks the promotion, and the previous Latest is frozen as `versioned_docs/version-<previous>` with its own release bundle. The writer workflow is detailed on the [Identity Platform migration map](../../wso2-docs-is-migration/map.md).
