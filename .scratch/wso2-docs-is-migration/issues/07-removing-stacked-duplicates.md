# How to remove stacked duplicates

Parent: [map](../map.md)
Type: grilling
Status: open
Assignee:
Blocked by: 02

## Question

Given the causes found in [Why 119 shared Identity pages render as stacked copies](02-why-shared-pages-stack.md), decide per cause (A to E, 93 pages) how the duplicates go away while the tree stays generated: a converter rule, a wrapper rewrite in the MkDocs source (who writes it, and whether the IS team must review those edits in the fork), or accepting a page as split into separate cloud-only and self-hosted-only pages. Also decide the gate wording in the PR: what counts as resolved. Include the frozen-version risk of editing shared includes, and the ~5 paths that are genuinely different pages.
