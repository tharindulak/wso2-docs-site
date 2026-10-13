# Map: Content components on Identity Platform

Label: wayfinder:map

## Destination

Four content components work on Identity Platform in the `docs-is-migrate` preview build: stepper, prerequisites block, closing sections and linked tabs. Each has tests, a short spec in its ticket, and an entry in the docs-is contributor guide. The docs team has reviewed the rendered pages.

## Notes

- Domain: documentation platform. Vocabulary in [CONTEXT.md](../../CONTEXT.md) (Content component, Content source, Cutover). A content component is placed explicitly or recognised from a writing convention (sharpened 2026-10-13).
- This map builds as well as plans (user decision 2026-10-13): decision tickets (prototype, grilling) are HITL; build tickets are AFK and test-first.
- Follows on from [Site features and content components](../wso2-docs-elements/map.md) (planning only), which keeps the rest of the candidates. Works on branch `docs-is-migrate`, worktree `.claude/worktrees/docs-is-migrate`.
- Standing decisions from charting (2026-10-13):
  - Components are built generically and verified on Identity Platform only.
  - Convention-recognised components are remark plugins in the site build (as `remark-steps`), not converter output. The source stays plain Markdown, so Markdown output and llms.txt stay clean, and writers keep the conventions after cutover.
  - Until cutover the Identity Platform `docusaurus/` tree is generated only (see the [migration map](../wso2-docs-is-migration/map.md)); no hand-written MDX.
  - Done per component: renders on real Identity Platform pages in the preview build, has tests, has a contributor guide entry.
- Facts (2026-10-13, Identity Platform Latest, 1,065 generated pages): 112 pages have a `## Prerequisites` / `## Before you begin` heading and 63 a `:::note[Before you begin]` admonition; about 37 have a closing section ("What's next?" 19, "What's next" 7, "Next steps" 8, "Learn more" 2, "See also" 1); 174 pages hold 427 `<Tabs>`, all with positional values (`tab-N`), groupId on 7 pages; frequent label sets: npm/yarn/pnpm, Visual Editor/Classic Editor, JKS/PKCS12, Windows/Linux/macOS, Request format/Sample request.
- Local build of the preview: `DOCS_SITE_TEST_OWNER=tharindulak npm run content -- identity`, then `DOCS_SITE_TEST_OWNER=tharindulak DOCS_SECTIONS=identity node scripts/docusaurus.mjs build site --out-dir build-preview`; served on :3000 by `node scripts/serve.mjs site/build-preview --port 3000`.
- Prototypes are kept on branch `prototype/docs-is-components` (latest commit dd3bf22): `prototypes/stepper/`, `prototypes/prerequisites/`, `prototypes/closing-sections/`.
- Skills every session should consult: grilling, domain-modeling. Research tickets use research; prototype tickets use prototype; build tickets use tdd.
- Outward-facing: commit to `docs-is-migrate` only; never push to or open PRs on `wso2/docs-is`.
- Treat findings as planning input for human review; flag security, licensing and supply-chain concerns for any new dependency.

## Decisions so far

<!-- one line per closed ticket -->

- Stepper (built before this map, from [Spec: automatic stepper from Step headings](../wso2-docs-elements/issues/09-automatic-stepper.md)): style A, circles and a line; `remark-steps` in the site build; commit `7f9e4e2` on `docs-is-migrate`; 239 of 6,568 Identity pages get one.
- [Can the site build read a linked page's title and description?](issues/04-linked-page-metadata.md): yes, at runtime: the plugin emits `<LinkCards>`, which reads `useDocsVersion().docs` (no dependency, never stale); only 2 of 125 linked targets have a front-matter description, so cards mostly show first-line excerpts.
- [Which tab label sets sync, and how](issues/01-linked-tabs.md): automatic groups from each block's normalised label set, choice kept in localStorage (not the URL), OS aliases only, typos fixed at source; author-set `groupId`s and single-tab blocks untouched; no opt-out.
- [Build linked tabs](issues/05-build-linked-tabs.md): `remark-linked-tabs` in `eaf4cd5`; 916 of 1,082 Identity tab blocks linked in 91 groups; preview rebuilt. "nnpm" fixed at source afterwards (fork `f30abe90`, tree `ce627dde`, lock `7730127`).
- [How the prerequisites block looks](issues/02-prerequisites-look.md): panel with ordinary bullets, in place; author's title; heading and admonition forms alike; `prerequisites: false` opt-out.
- [How closing sections look](issues/03-closing-sections-look.md): cards for sections that are a list of links (prose left as written); description from the author's text, else the linked doc's; `link_cards: false` opt-out.
- [Build the prerequisites block](issues/06-build-prerequisites.md): `remark-prerequisites` in `d4afa63`; 199 panels on 168 Identity Latest pages; preview rebuilt.
- [Build closing sections](issues/07-build-closing-sections.md): `remark-link-cards` and `LinkCards` in `fa74e2f`; cards on 26 Identity Latest pages after `c87d228` allowed one intro paragraph before the list.

## Not yet specified

- Three tab blocks render as raw HTML instead of Docusaurus tabs (lowercase `tabitem`): a converter bug, likely for the [migration map](../wso2-docs-is-migration/map.md); needs a look at the source markup first.
- Writing front-matter descriptions for the ~97 pages linked from closing sections, if first-line excerpts read badly in [How closing sections look](issues/03-closing-sections-look.md): content work for the Identity Platform writers; who asks them and how.
- Lifecycle badges (Beta / Preview / GA / Deprecated) and deprecation notices with a central Deprecations page: almost no Identity Platform content uses them today (2 "beta", 1 "experimental", 29 "deprecated" in prose on 10 pages). Revisit after cutover, when writers can place MDX components directly.
- Required roles: free prose today, not detectable; may become part of the prerequisites block once its look is settled.
- Explicit MDX tags for convention-recognised components, for writers after cutover who want a component without the convention.

## Out of scope

- PRs to `wso2/docs-is`, or cutover itself: owned by the [migration map](../wso2-docs-is-migration/map.md).
- Verifying the components on products other than Identity Platform (they get them where detection applies, unchecked).
- Editorial rewrites of Identity Platform pages to fit a convention.
