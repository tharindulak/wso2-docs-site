# Why 119 shared Identity pages render as stacked copies

Parent: [map](../map.md)
Type: research
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

In the merged Latest (Asgardeo plus IS 7.3.0), 119 shared page paths cannot merge node by node and render as two stacked copies ([Content format for content sources](../../wso2-docs-site/issues/06-content-format.md)). Recount at the current pinned SHA and sort every one by cause: wrapper pages that include different files, different `{% set %}` blocks, heading or structure drift between the two sides, or converter limits. For each cause, say whether a converter change or a rewrite of the MkDocs wrapper would make it merge, with page counts and two examples each.

## Answer

Research, 2026-10-13. Findings on branch `research/why-shared-pages-stack` (commit ab898e1), file `.scratch/wso2-docs-is-migration/research/02-why-shared-pages-stack.md`. Analysis scripts and the merge prototype stayed in the session scratchpad, uncommitted.

- **Recount at c2176fcd1b50: 93 stack, not 119.** 525 shared paths: 430 merge, 93 stack, 2 fail (already excluded). The drop is a converter change: `splitPageData` now strips front matter and quick-start meta before comparing (26 pages, all 11 `quick-starts/*` among them).
- **Mechanism:** `merge.ts` compares the wrappers' top-level structure; any difference stacks the whole page.

| Cause | Pages | Fix |
|---|---|---|
| A. API reference with a different OpenAPI file per product | 32 | Converter, plus `ApiReference` taking one spec per deployment option (31 specs genuinely differ; `rule-metadata-rest-api.md` only differs in URL spelling) |
| B. Same include, different wrapper text around it | 16 | Converter: align wrappers on shared includes (prototyped, all 16 merge) |
| C. Different include files | 2 | 1 converter (alignment), 1 source rewrite |
| D. One side includes, the other has a drifted inline copy | 22 | Source: port differences into the include as conditionals, then rewrite the wrapper |
| E. Both inline, structure drift | 21 | Source: new shared include (a diff fallback would only suit 18 of D+E) |
| F. Different `{% set %}` only | 0 | none |

- **Converter fixes clear 49; source rewrites clear 44.** The alignment prototype took 93 to 76 with no regressions on already-merged pages.
- **Risks:** includes edited for D are shared with frozen older versions (for example `qsg-oidc-webapp-java-ee.md` in 7.0.0 to 7.3.0 and `next`), so edits need `is_version` guards. About 5 paths are genuinely different pages sharing a path (`apis/index.md`, `guides/users/user-stores/index.md`, `guides/users/manage-administrators.md`); [How to remove stacked duplicates](07-removing-stacked-duplicates.md) decides whether labelled versions are acceptable there.
