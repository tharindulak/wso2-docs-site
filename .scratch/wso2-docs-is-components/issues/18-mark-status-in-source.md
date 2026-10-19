# Mark the seed pages and the team's list in the fork's source

Parent: [map](../map.md)
Type: task
Status: open
Assignee: tharinduj
Blocked by: 12, 13

## Question

Mark lifecycle status in the MkDocs source on the fork (`/Users/admin/Documents/wso2/git/docs`, branch `docusaurus-migration`) as decided in [Where status is written, and what a deprecation carries](12-status-source-and-deprecation-data.md): first the seed (3 "(Deprecated)" API pages, 3 deprecated admonitions), then the list from [Get the Identity Platform team's list of Beta, Preview and Deprecated features](13-identity-team-status-list.md). Regenerate the tree (recipe in [Build linked tabs](05-build-linked-tabs.md)), bump the lock on `docs-is-migrate`, rebuild the preview.

Scope (from [Which lifecycle stages, and what each means](11-lifecycle-stages.md)): mark every version where the feature appears, not only Latest; only the Deprecated phase of self-hosted deprecations.

Progress 2026-10-14 (seed done, user asked for it before the team's list): fork commit `274ef7ec` marks 21 pages that the nav labels "(deprecated)" (Asgardeo; IS 7.0.0, 7.1.0, 7.2.0, 7.3.0, next) with `status: deprecated`, `deprecated_since` and `replacement`, and changes the 3 "Deprecated ..." warnings to `!!! deprecated`. Evidence: `deprecated_since` is the first IS version whose nav marks the API; for Asgardeo, the month the API spec title first said deprecated (GitHub history of `wso2/docs-is`: User Sharing 2026-03-10, User Credential Management 2026-06-14). Replacement: the v2 page beside it in the nav. No removal dates. Converter `df008da` keeps `!!! deprecated` looking like a warning until notices render. Remaining: the team's list (ticket 13); user credential management v1 in `next` (version unknown).
