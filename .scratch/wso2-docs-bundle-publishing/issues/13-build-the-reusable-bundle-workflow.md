# Build the reusable bundle workflow

Parent: [map](../map.md)
Type: task (AFK, HITL for the fork run)
Status: open
Assignee: tharindulak
Blocked by: 05

## Question

Build what [Reusable bundle workflow spec](05-reusable-bundle-workflow-spec.md) decided, on branch `feat/docs-bundle-workflow` cut from `docs-site-build`: the docs manifest (converter config accepting `section` and `nav`, JSON Schema), `wso2-docs manifest init`, a `wso2-docs bundle` command (resolve section from branch, check, deterministic zip, report), the reusable `.github/workflows/docs-bundle.yml` (`workflow_call`; check-only on pull requests), the onboarding setup script and checklist. Executable-content rule starts strict (reject `.ts`/`.js` sidebars and config) until [Executable content in bundles](10-executable-content-in-bundles.md) decides. Prove it on `tharindulak/docs-api-platform` with API Gateway 1.2.0 as a prerelease, then clean up after the user confirms.
