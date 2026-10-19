# Rewrite the docs-is tree to explicit components

Parent: [map](../map.md)
Type: task
Status: closed
Assignee: tharinduj
Blocked by: 06, 03

## Question

AFK: the one-off converter run that writes explicit components into the docs-is tree (and renames to `.mdx` if so decided), regenerate, review the diff (counts per component, pages left as written and why), commit on the fork, bump the lock, rebuild the preview.

Input (2026-10-14) from [Should authored pages be .mdx or .md?](03-md-or-mdx.md): rename every authored page to `.mdx` in all versions and rewrite links; drop `mdx.format: md` from the 16 pages that compile; extend the converter's fixes so the other 79 compile as MDX; report any left for a hand fix in the MkDocs source. And from [How writers write each component](01-component-api.md): keep old step anchors as explicit ids; Prerequisites admonitions become the `title` form.

Input (2026-10-14) from [What a writer sees](04-writer-experience.md): write old anchors as `{/* #id */}`; close a nested `<Steps>` at the next heading and list the pages where text follows the last sub-step for review; Steps may be `###` under a `##` section.

Input (2026-10-14) from [Build the explicit components on one rendering path](06-build-components.md): use `writeComponents` (`src/conventions.ts`) for the one-off rewrite; then remove the TEMPORARY line in `prepareDocusaurusDocs` (`site.ts`); produce the review list of pages where text follows the last sub-step; fix the CommonMark pages (3 in Latest lose their prerequisites panel until then).

## Answer

Built 2026-10-14 (AFK, test-first). `docs-is-migrate`: `ba6368f` (tree writer and converter: `.mdx` output, link rewriting, `repairMdx`, MDX fixes, TEMPORARY line removed) and `bcfe197` (lock at fork `ccc29cd0`). Fork `docusaurus-migration`: `318af35e` (hand fixes in `en/`, 12 pages) and `ccc29cd0` (regenerated tree).

- **All 6,528 pages are `.mdx`** in every version (git: 6,442 renames, 86 delete/add pairs); page links and lifecycle `replacement:` fields point at the new names; sidebars (doc ids), `redirects.json`, `versions.json` and edit links unchanged. All 6,568 tree files and all generated files compile as MDX.
- **Components in the tree** (Latest / all versions): `<Steps>` 72 (+15 nested) / 266 (+43 nested); `<Prerequisites>` around a heading 127 / 627; `<Prerequisites title>` 77 / 592; `<LinkCards>` 27 / 87; old anchors `{/* #id */}` 330 / 1,061.
- **CommonMark pages: 95 to 0.** The converter repairs what the MDX parser reports before falling back (`repairMdx`), plus fixes for nested admonition fences, `|` in table code, comment-wrapped code blocks and unclosed HTML blocks; `writeComponents` leaves a page as written if its output would not parse. 12 pages needed source fixes in `en/` (XACML scope validation 5.9.0 to 5.11.0, customizing secure vault 5.9.0 to 5.11.0, resend account recovery mail 6.0.0 and 6.1.0, and the shared self-service onboarding include, whose two tables became lists): **these need Identity Server team review.**
- **Sub-step review list:** 43 nested `<Steps>` in 25 files (15 in Latest) at `docs-site/generated/tree-review.txt` (broad: any text after the last sub-step's heading).
- Tests: converter 276/276, scripts and site 123/123. Content: 1,065 pages, no new failures.
- Latest-only build: `[WARNING]` lines 33 as before; broken-anchor pages 96 (was 99), broken-link pages 60 (was 63), because links inside raw JSX tables on formerly CommonMark pages are not checked by Docusaurus (a blind spot for any MDX page with an HTML table). Per-page comparison: 1,338 of 1,353 the same; the three lost prerequisites panels are back; 4 new differences follow the source (two Next.js complete-guide pages whose content is commented out in `en/` now render almost empty; bot-detection's commented section now hidden; springboot quick-start's swallowed h2 now renders).
- Open: decide whether to restore or remove the two near-empty Next.js pages; repaired pages may show broken source markup as text (e.g. `<IS_HOME>`).
- Follow-up 2026-10-14: the full rebuild stopped on the 7.2.0 snapshot's link gate (an image in `deploy/deployment-guide`). Root cause: `htmlBlocksToJsx` (`html-blocks.ts`) did not track HTML comments, so a commented-out `<ol>` with an image leaked once the page became MDX. Fixed in `4bbb8d1` (one regression test; 277/277), tree regenerated at fork `e3c27edd` (4 files: `deploy/deployment-guide` in Latest, 7.2.0, 7.1.0, 7.0.0), lock `734cc26`. Snapshots 7.2.0, 7.1.0, 7.0.0 pass their gates.
