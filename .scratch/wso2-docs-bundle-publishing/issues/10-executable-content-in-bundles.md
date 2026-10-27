# Executable content in bundles

Parent: [map](../map.md)
Type: grilling (HITL)
Status: open
Assignee:
Blocked by: 03

## Question

Docusaurus sidebars written as `.ts`/`.js` (docs-integrator imports `src/utils`; Healthcare uses `sidebars.js`) and pages importing `@site/...` run code during the build, in the job that holds the R2 and VM upload keys. With auto-merging lock PRs no person reviews a bundle before that code runs. Decide: accept only data (JSON or YAML sidebars, no executable files) in bundles and reject the rest at intake, convert sidebars to data in the reusable bundle workflow, or run the build of bundle content in a sandbox without deploy keys. Needs a security review before hand-off.

Also covers MDX (imports, expressions) and MkDocs config that can run code at build, and the rule that the reusable bundle workflow runs no content-repo code before it packs and attests (see [GitHub releases, attestations and safe zip intake](02-releases-attestations-and-safe-zip-intake.md)).

Update 2026-10-27: navigation is now plain YAML in the docs manifest and `.ts`/`.js` sidebars are rejected ([Docs bundle layout and manifest](03-docs-bundle-layout-and-manifest.md)). What remains: MDX imports and expressions, `@site/...` imports, and MkDocs config.
