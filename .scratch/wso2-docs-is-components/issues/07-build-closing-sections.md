# Build closing sections

Parent: [map](../map.md)
Type: task
Status: closed
Assignee: tharinduj
Blocked by: 03, 04

## Question

Build closing sections as decided in [How closing sections look](03-closing-sections-look.md), using the metadata route from [Can the site build read a linked page's title and description?](04-linked-page-metadata.md): tests (tdd), wiring, rebuilt into the Identity Platform preview and checked on real pages. Record the commit and the pages affected.

Spec: the answer on [How closing sections look](03-closing-sections-look.md); styles from `prototypes/closing-sections/closing.css` ("A. Cards"). Route from research 04: the remark plugin wraps a qualifying list in a `<LinkCards>` component, keeping the list as its fallback content and passing each item's href, link text and author text; the component (registered globally in `site/src/theme/MDXComponents`) maps internal links to docs through global data and reads `useDocsVersion().docs[id].description` (never `useDocById`, which throws). Tests must cover: every title wording at h2/h3, a qualifying list, prose and nested lists left alone, author text extraction, internal / external / unresolvable links, sections inside `<Applies>` and partials, trailing-slash matching, CommonMark fallback pages, the opt-out.

## Answer

Built 2026-10-14 (AFK, test-first): commit `fa74e2f` on `docs-is-migrate`. `remark-link-cards` (exported `@wso2/docs-converter/remark-link-cards`, wired last) wraps a qualifying list in `<LinkCards>` with the list as fallback; `site/src/components/LinkCards.js` (registered globally) resolves descriptions through `site/src/lib/link-cards.mjs` (author text, else `useDocsVersion().docs[id].description`, else host for external links); styles `.link-cards` in `site.css`.

- Rules as specified, applied strictly: "exactly one list" means an intro line before the list keeps the section as written. Ordered and loose lists qualify; the first content of an item's first paragraph must be a link. `link_cards: false` on a page also covers its partials (read through `useDoc()`).
- Tests: converter 205/205 (15 new, real MDX through Docusaurus's own remark plugins and a recording JSX runtime); scripts and site 107/107 (9 for description resolution, 1 for plugin order).
- Real content: Identity Latest 51 closing sections, 21 become cards on 19 pages (46 links, 20 with author text); 30 left as written: list plus an intro or other block 15, a single paragraph 8, prose bullets 6, several blocks 1. All versions: 55 of 209.
- Preview rebuilt (also picks up `2559a90`); warnings identical to the previous build. Verified server-rendered cards on oid4vci (author text), login-flow-builder (doc descriptions, clamped), register-mobile-app (one card); keystores stays as written.
- Relies on Docusaurus internals: `useDocsVersion().docs` (marked "TODO v4"), global data shape, `useDoc`, plugin order after `resolveMarkdownLinks`; recheck on v4. No new dependencies. Item data is built as an expression from values, never code strings; descriptions render as text.
- Note: the prerequisites compile check (`check-prereq.mjs`) compiled `.md` pages as CommonMark, so its counts may be slightly off; the build itself is unaffected.
- Follow-up 2026-10-14 (user decision): `c87d228` allows one intro paragraph before the list (it stays above the cards); Identity Latest pages with cards 19 to 26. Tests 206/206 and 107/107; preview rebuilt, warnings identical.
