# What a writer sees

Parent: [map](../map.md)
Type: prototype
Status: closed
Assignee: tharinduj
Blocked by: 01

## Question

One real Identity Platform page (with steps, sub-steps, prerequisites, tabs and a closing section) rewritten with the components as decided, shown as source and rendered; plus the check's messages on a page that misses a component. Judge the authoring experience before building.

## Answer

Resolved 2026-10-14 by prototype (user decisions). Prototype: `prototypes/authoring/` (MS Entra and login-flow-builder rewritten as `.mdx`, a page written the old way, a throwaway check; source, rendered, side-by-side and check views on port 3027), kept on branch `prototype/docs-is-components`. The check gave 0 errors on both rewritten pages and 7 on the old-style page; on today's Entra `.md` it gave 3 (the extension, 14 Step headings outside `<Steps>`, the Before-you-begin note).

- **The decided forms work on real content**; no change to [How writers write each component](01-component-api.md).
- **Old anchors are written `{/* #id */}`**, e.g. `## Create a key vault {/* #step-11-create-a-key-vault */}`. Plain MDX rejects `{#id}` (Docusaurus 3.10 accepts it only by rewriting it first); the comment form parses the same in Docusaurus, the check and editors.
- **Stale "step-N" ids are accepted**: they only keep old links working; headings written after cutover get normal ids, and the guide says not to copy the old ones.
- **A nested `</Steps>` closes at the next heading** in the rewrite (as the site renders today); the rewrite lists pages where text follows the last sub-step, for a writer to review.
- Seen on the way: `<Prerequisites>` can sit inside a step (Entra step 1); steps may be `###` (login-flow-builder); closing tags pile up at the end of nested procedures; card descriptions taken from linked pages are invisible in the source.

