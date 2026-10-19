# Includes as MDX partials in Latest

Parent: [map](../map.md)
Type: prototype
Status: resolved
Assignee: tharinduj
Blocked by: 04

## Question

For the unified Latest, shared includes become MDX partials (`docusaurus/docs/_partials/*.mdx`) imported by pages, while frozen versions stay inlined. Includes today contain Jinja conditionals and per-product variables that the merge resolves differently on each side. Prototype on a slice of docs-is: which includes become one partial, which split into per-deployment partials or partials taking props, when to inline anyway (used once, or diverging per side), and how merged pages reference them. Judge what writers see and whether the output stays reproducible from one command. Partials live in `docs/_partials/` with no front matter ([Docusaurus tree format decisions](12-tree-format-decisions.md)); confirm what happens to a partial's headings in the page TOC.

## Answer

Prototype and decisions with the user, 2026-10-13. Prototype on branch `prototype/includes-as-partials` (commit b6ca030): `prototypes/partials/` (hooked converter copy, `survey.mjs`, `survey-13256c36.json`).

Survey of Latest (Asgardeo + IS 7.3.0 at fork `13256c36`): 691 include files, 829 uses.

| Include | Files | Uses | Content |
|---|---|---|---|
| Used by one Latest page only (shared only between the Asgardeo and IS wrappers of that page; the merge removes the need) | 643 | 671 | 3.9 MB |
| Used by several pages, identical everywhere (for example IS database config snippets) | 23 | 103 | 0.1 MB |
| Used by pages of different deployment options (a cloud-only and a self-hosted-only page, for example `references/accessibility.md`, `deploy/ctl-tool/*`) | 25 | 55 | 0.2 MB |

No include is used mid-line or inside code, and none renders differently by page in Latest, so no partial needs props (which would need `{…}` expressions the MDX contract forbids). Docusaurus 3.10.2 shows a partial's headings in the importing page's TOC and gives `_partials/` files no route (tested on a minimal site).

Decisions:

1. **Rule:** an include becomes a partial only if more than one Latest page uses it (48 today); every other include is inlined into its page. Nested includes are inlined into the partial unless they are partials themselves.
2. **One partial per include, labelled inside:** a partial keeps its `<Applies>` blocks, and `<Applies>` hides blocks for deployment options the page does not cover (from the page's `deployment_options`). No per-option partial copies. Docs-site component change.
3. **Names mirror the include path:** `en/includes/deploy/ctl-tool/x.md` becomes `docs/_partials/deploy/ctl-tool/x.mdx`; the partial's edit link points at the include in `en/` until cutover.
