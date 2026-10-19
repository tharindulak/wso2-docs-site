# Pick the pilot sections

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharinduj
Blocked by: 02, 07

## Question

Which sections prove the pipeline before rolling it out to every product? The pilot should cover a release-branch source and a version-folder source (for example Micro Integrator and Identity Platform), at least one frozen version and an "Older versions" link to Confluence, and enough versions to exercise the chosen build architecture. What counts as the pilot passing? Passing must include measuring the live build with Latest plus the previous release for the pilot sections (time and memory, with and without Docusaurus Faster), so the [build architecture](07-build-architecture.md) live window is confirmed or narrowed before rollout.

## Answer

Decided with the user, 2026-10-09 (all recommendations accepted).

- **Sections:** Identity Platform and Micro Integrator.
  - Identity Platform covers version folders, the Latest cloud and self-hosted merge, Confluence links for 5.0 to 5.8, and the Jinja fix for 5.9 to 5.11.
  - Micro Integrator covers release branches, the move of Latest to 4.6.0, a change of MkDocs layout between versions, and `former_site` self-links.
  - Multi-component tags (docs-api-platform) are not covered.
- **Versions:** all 14 versions of both sections. That is 4 live (Latest plus the previous release of each) and 10 snapshots.
- **Pass criteria:**
  1. Every version is served at `/<route>/<version>/`, and Latest has no version segment.
  2. The selector keeps the reader on the same page across live and snapshot versions, falls back to the version home and lists the Confluence versions.
  3. The lock file uses the new schema, and the validator passes.
  4. The link check passes on each snapshot and on the merged output.
  5. Measurements are recorded: live build time and memory with and without Docusaurus Faster, time and size per snapshot, and image storage before and after deduplication.
  6. A promotion dry run works: a test docs release on a fork (for example `v4.6.0.1` on a fork of docs-mi) produces the bot PR, and a simulated new version moves the previous Latest to a snapshot. Nothing is released on wso2 repos.
- **When the live window narrows:** if a full live build at Latest plus the previous release, extrapolated from the pilot, exceeds 60 minutes or 14 GB of memory, the live window becomes Latest only.
- **Deadline:** pilot done by 2026-10-23, leaving three weeks for rollout and one week of buffer before WSO2Con (2026-11-20).
- **Where:** branch `docs-site-versions` off `docs-site-build` in this repo. Nothing is pushed to the wso2 content repos.
