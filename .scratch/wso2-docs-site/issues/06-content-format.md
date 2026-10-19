# Content format for content sources

Parent: [map](../map.md)
Type: prototype
Status: resolved
Assignee: tharinduj
Blocked by: 01, 02

## Question

Do content sources convert their pages to MDX, or does the docs site read their MkDocs Markdown at build time through plugins that handle includes, product_name conditionals, admonitions, tabs and variables? Prototype both against a slice of docs-is (which reuses 896 include files) and judge writer effort, migration cost and build reliability.

## Prototype findings (2026-10-06)

Prototype: `prototypes/content-format/` (`npm run convert -- <docs-is checkout> site/content/identity`, `npm run check`, `npm run prototype`, then http://localhost:3010/identity/). Source: docs-is at c2176fc, Asgardeo (WSO2 Cloud) merged with Identity Server 7.3.0 (Self-hosted) into one "Latest" doc set.

Source survey (en/includes, 726 files): 689 `{% if %}` in 259 files (599 test product_name, 331 test is_version), 3,517 `{{ product_name }}`, 1,416 admonitions, 749 tabs, 1,567 attr_list, 1,356 raw HTML tags. Wrapper pages also `{% set %}` per-product values, including whole Markdown sections. Latent bugs: version checks compare strings (7.10.0 would sort before 7.2.0); two conditions test "WSO2 Identity Server " with a trailing space.

| Result | Count |
|---|---|
| Pages in Latest | 1,024: 525 shared paths, 173 cloud-only, 326 self-hosted-only |
| Shared pages merged node by node | 401 |
| Shared pages that could not merge (wrappers include different files), rendered as two stacked copies | 119 |
| Conditionals: same branch both sides / split into labelled `<Applies>` blocks | 146 / 290 (13 inside code samples) |
| `product_name` in shared text, needing one name | 1,947 |
| Other variables that differ per side (host names, URLs, notes) | 55 names, ~600 uses |
| Converter failures (ternary, literal `{{`, missing include) | 8 |
| Compile as MDX after automatic conversion | 874 / 1,016 (86%); rest are HTML errors browsers tolerate (stray `</tr>`, `</br>`, unclosed tags) |
| Full Docusaurus build of the 874 | succeeds, 871 pages |

- Syntax (admonitions, tabs, collapsibles, attr_list, most HTML) converts mechanically; either option can use the same converter.
- The hard part is editorial, not syntax: today one source renders as two products' pages; a unified page exposes every product split as a labelled block, every differing value as a placeholder or pair, and 119 pages as duplicates.

## Answer

Decided with the user, 2026-10-06.

- **Convert at build time** (user chose this over the recommended one-time conversion). Content sources keep authoring MkDocs Markdown with their Jinja conditionals; the docs site runs a converter on every build that merges each product's cloud and self-hosted trees into one Latest doc set, rewrites MkDocs syntax to MDX, and labels deployment-specific content with `<Applies>` blocks and `<DeploymentValue>` pairs (placeholders inside code).
- Accepted trade-off: readers get machine-merged pages (in docs-is today: 290 labelled blocks, 119 stacked duplicate pages, ~600 differing values). Teams improve them by rewriting conditionals in their own source.
- Consequences: the converter is production code owned by the docs site (rewrite with tests; the prototype's allow-listed condition parser, never `eval`, is the pattern to keep). Content sources must fix HTML that MDX rejects (~142 pages in docs-is) in their MkDocs source.
- **Product name** in shared text: "Identity Platform" (the Product); "Identity Server" only inside self-hosted-only content, where the converter already renders the self-hosted `product_name`. Confirm with the Identity Server team.
- Older self-hosted versions need no merge: render each version alone.
- Open follow-up: [Build-time conversion contract](13-conversion-contract.md).
- Prototype captured on branch `prototype/content-format` (`prototypes/content-format/`).

## Superseded for Identity Platform (2026-10-13)

The user decided a one-time migration of docs-is to Docusaurus. Build-time conversion still holds for every other product. See [Migrate Identity Platform docs (docs-is) to Docusaurus](../../wso2-docs-is-migration/map.md).
