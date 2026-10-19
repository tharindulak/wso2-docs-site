# Map: Writers author with WSO2 content components

Label: wayfinder:map

## Destination

Identity Platform writers author with WSO2 content components in Docusaurus Markdown: each component has a documented, writer-friendly form; the docs-is tree uses them throughout (converted once); the fork's CI rejects hand-written patterns a component covers; and the contributor guide teaches them. Ready at cutover.

## Notes

- Domain: documentation platform. Vocabulary in [CONTEXT.md](../../CONTEXT.md) (Content component, Cutover, Content source, Lifecycle stage, Deprecation notice, Linked tabs). "Content component" was sharpened 2026-10-14: writers of migrated content place components explicitly and are held to them.
- Why this map exists (feedback the user received, 2026-10-14): instead of recognising existing writing and rendering it as components, give writers the components to write in their Docusaurus docs and enforce them. Changing an element is cheap; making writers restructure docs to fit a convention is costly.
- This map builds as well as plans (user decision 2026-10-14), like [Content components on Identity Platform](../wso2-docs-is-components/map.md) and the [migration map](../wso2-docs-is-migration/map.md).
- Standing decisions from charting (2026-10-14):
  - Writers place components explicitly in the Docusaurus files; a check holds them to it (a hand-written pattern a component covers is flagged).
  - Identity Platform first, effective from cutover; other products adopt the same contract when they migrate.
  - Existing pages are rewritten to explicit components once, by the converter, as part of the migration (no cost to writers; reviewed once in the migration PR).
  - One rendering path: the site renders only the explicit components; today's convention plugins become converter steps that produce them (for the one-off Identity rewrite and for MkDocs products on every build).
- Relation to other maps: replaces the components map's standing decision "recognise conventions in the site build"; its "Explicit MDX tags" item and its contributor guide ticket move here. The migration map's [Authored-MDX contract and CI check for docs-is](../wso2-docs-is-migration/issues/08-authored-mdx-contract.md) lists the components decided here and hosts the check's CI.
- Facts (2026-10-14): the site compiles every page as MDX (`markdown.format: 'mdx'`); the docs-is tree has 6,528 `.md` and 40 `.mdx` (partials) files; 345 Latest pages already use `<Applies>`, `<Tabs>` or `<DeploymentValue>` in `.md`; 95 pages (15 in Latest) declare `mdx.format: md` and cannot host components. Convention counts in Identity: about 1,000 step pages, 180 prerequisites blocks, 900 tab blocks, 50 closing sections, 21 deprecations.
- Docs-is fork clone: `/Users/admin/Documents/wso2/git/docs/docs-is`, branch `docusaurus-migration`; docs-site code on Wso2-Cloud branch `docs-is-migrate`.
- Prototypes are kept on branch `prototype/docs-is-components` (latest commit ff0b5a8): `prototypes/authoring/`.
- Priority (user, 2026-10-14): the check is not a priority at the moment; [Build the check](issues/08-build-check.md) is on hold, and [The Identity Server team reviews the component contract](issues/10-is-team-review.md) can go ahead without it if the user decides so.
- Skills every session should consult: grilling, domain-modeling. Research tickets use research; prototype tickets use prototype; build tickets use tdd.
- Outward-facing: push only to the user's repos (`tharindulak/*`); never to `wso2/docs-is`.
- Treat findings as planning input for human review; flag security, licensing and supply-chain concerns for any new dependency (lint tools especially).

## Decisions so far

<!-- one line per closed ticket -->

- [What tools can check MDX for missing components](issues/02-mdx-lint-tools.md): extend our own `wso2-docs check` with a contract pass (no new packages); remark-lint is the best off-the-shelf fallback; markdownlint has no MDX; Vale and eslint-mdx add nothing for component rules; the allowed-components list must include `ApiReference` and others already in use.
- [How writers write each component](issues/01-component-api.md): `<Steps>` wraps headings with automatic numbers (nested `<Steps>` for one level of sub-steps, `start` attribute, old anchors kept as explicit ids); `<Prerequisites>` with a heading or a `title`; `<LinkCards>` wraps a list; `:::deprecated[…]`; tabs and lifecycle front matter unchanged.
- [Should authored pages be .mdx or .md?](issues/03-md-or-mdx.md): `.mdx` for every authored page in all versions, renamed in the one-off rewrite; no CommonMark pages (16 drop the flag, 79 fixed by the converter).
- [What a writer sees](issues/04-writer-experience.md): the forms work on real content (0 check errors on two rewritten pages); old anchors as `{/* #id */}`; stale step-N ids accepted; nested `</Steps>` closes at the next heading, with a review list.
- [What the check enforces](issues/05-check-rules.md): errors for hand-written patterns a component covers, unknown components, CommonMark and `.md`; a warning for unwrapped closing lists; all pages, all versions; ignore comment with a reason; fork CI plus a local command. Building it is on hold (not a priority at the moment).
- [Build the explicit components on one rendering path](issues/06-build-components.md): `389d7bf`: the site renders only `<Steps>`, `<Prerequisites>`, `<LinkCards>`; recognition moved to the converter step `writeComponents` (temporarily also applied to the Identity tree until the rewrite); 1,339 of 1,353 pages identical.
- [Rewrite the docs-is tree to explicit components](issues/07-rewrite-tree.md): fork `ccc29cd0` (lock `bcfe197`): all 6,528 pages `.mdx` with explicit components in every version; CommonMark pages 95 to 0 (12 hand fixes in `en/` need IS team review); sub-step review list of 25 files.

## Not yet specified

- 57 tree files show an escaped `&lt;!--` as visible text (HTML comments leaking through another path than the one fixed in `4bbb8d1`), e.g. `references/default-ports`, `deploy/set-up-separate-databases-for-clustering`, many 6.x includes; and some pages reference assets their version's source lacks (6.x identity-provider icons, 7.x `page-not-found.svg`). Both pass the link gates today; they need a converter follow-up.
- Two Next.js complete-guide pages render almost empty now that their commented-out content no longer leaks (as in MkDocs): restore or remove, with the Identity Server team.
- Docusaurus does not check links inside raw JSX tables, so broken links on pages with HTML tables go unreported (a link-check blind spot, likely for the migration map).
- Other products: when each migrates, it adopts the same contract; until then their MkDocs content gets components from conventions at conversion.
- Editor help for writers (snippets, templates, a page scaffold) if the guide and check are not enough.

## Out of scope

- Cutover itself and PRs to `wso2/docs-is`: the [migration map](../wso2-docs-is-migration/map.md).
- New components beyond the six built on the [components map](../wso2-docs-is-components/map.md).
