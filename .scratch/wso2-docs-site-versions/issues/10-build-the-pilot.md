# Build the pilot

Parent: [map](../map.md)
Type: task (AFK)
Status: closed
Assignee: tharinduj
Blocked by: 

## Question

Implement the pilot decided in [Pick the pilot sections](08-pilot-sections.md) on branch `docs-site-versions`, following [Lock file schema](06-lock-file-schema.md), [Build architecture](07-build-architecture.md), [Choose the Latest source](01-latest-source-per-section.md) and [Docs-release convention](05-docs-release-convention.md). Spans several sessions, so write an implementation plan first (writing-plans). Scope:

- Schema change and validator.
- Multi-ref fetch.
- The converter's Jinja-plugin fix.
- Content-hashed images.
- Snapshot builds as a CI matrix, with tarball storage on a GitHub Release.
- `versions.json` and the selector change.
- Merged-output link check.
- Bump bot support for docs releases and promotion.
- `docs-site/CONTENT-RELEASES.md`.

Resolved when the six pass criteria are met and the measurements are recorded, including whether the live window stays at Latest plus the previous release.

## Assets

- [Implementation plan](../plans/2026-10-09-build-the-pilot.md) (2026-10-09, executed subagent-driven)
- [Pilot measurements and pass criteria](../research/10-pilot-measurements.md)

## Answer

Built on branch `docs-site-versions` (37 commits from `9d04529`, not merged or pushed). Identity Platform (9 versions, 7.3.0 Latest) and Micro Integrator (5 versions, 4.6.0 Latest) are served from one site: Latest in the live build, every older version as a frozen snapshot merged under `/<route>/<version>/`, Confluence versions linked under "Older versions".

- **Live window narrows to Latest only** (`live_window: 1`). A build of Latest plus the previous release ran out of memory at a 12 GB heap, and the extrapolation exceeds 60 min and 14 GB. The Latest-only live build of every product takes 34 min cold at a 12 GB heap (`DOCS_HEAP_MB=12288`), under 10 min warm.
- **Pass criteria:** 1 URLs pass; 2 selector pass (browser check after the fix wave); 3 schema and validator pass; 4 link checks pass against committed baselines (0 new broken links; 2,785 known, listed per version and in `link-baselines/live.json`); 5 measurements recorded, Faster not measured (needs the new `@docusaurus/faster` dependency); 6 promotion passed offline, the fork release is not done.
- **Whole-branch review** found 3 Critical and 9 Important issues, all fixed and re-reviewed clean: the cross-bundle link guard imported a missing `matchRoutes`; relative file references (images, attachments, OpenAPI specs) were not copied; the hourly bump re-pinned every version sharing a sha; PR CI deadlock on snapshot keys; and others in the plan's workspace review.
- **Carried forward:** criteria 5 and 6 leftovers and the first CI run go to [Finish the pilot sign-off](15-finish-pilot-sign-off.md); known broken links stay with [Fix link conversion for older versions](14-fix-link-conversion-older-versions.md).
