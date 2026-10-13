# Can the site build read a linked page's title and description?

Parent: [map](../map.md)
Type: research
Status: closed
Assignee: tharinduj
Blocked by: 

## Question

Link cards in a closing section need each linked page's title and description. Can a remark plugin running inside Docusaurus 3.10 (`@docusaurus/plugin-content-docs`, per-version plugin instances, `remarkPlugins` run after the default plugins) get the title and `description` front matter of another doc it links to, at build time? Options to check: reading the target file from disk by resolved path, Docusaurus's own doc metadata (global data, `useDocById`, `DocCardList`-style components rendering at runtime), a pre-built index written by `scripts/build-content.mjs`. What do Identity Platform pages actually carry in `description` (count present, quality)? Cost, ordering constraints and failure modes of each.

Research, 2026-10-13. Findings on branch `research/linked-page-metadata` (commit 85f99da), file `.scratch/wso2-docs-is-components/research/04-linked-page-metadata.md`.

## Answer

Yes, through the data Docusaurus already ships, not at remark time. Gist:

- Recommended: the remark plugin wraps a qualifying closing-section list in a `<LinkCards>` component and keeps the list as fallback; the component maps each link to a doc id through global data and reads `useDocsVersion().docs[id]` (`{title, description}`, as `DocCard` does). No new dependency, never stale, server-rendered. Do not use `useDocById` (throws on a missing doc).
- Remark plugins run after Docusaurus rewrites `.md` links to URLs, and cannot see other docs' metadata; anything copied from page B into page A at build time goes stale when only B changes (no cross-file dependency in the cache).
- Limits: links to another version or product get a plain card (link text, no description); none in the Identity sample.
- Alternatives: a per-version index written by `build-content.mjs` (covers other versions and products, but copies Docusaurus's title and excerpt rules and must join the snapshot key); reading target files from disk (only before link rewriting, stale in cache, needs path confinement). Both would need `@docusaurus/utils` pinned or its MIT excerpt code copied.
- Content gap: 176 of 1,022 Identity Latest pages (17%) have a front-matter `description`, mostly API boilerplate; only 2 of 125 linked targets do. With Docusaurus's first-line fallback 95 of 97 linked pages get some description, some cut mid-sentence or over 300 characters.
- Closing sections: 71 on 59 pages plus 3 in partials; 149 links, 85% relative `.md`, 19 external. Must look inside `<Applies>` and partials.
- Broken links seen: `manage-organizations.md` in `guides/organization-management/organizations-overview.md`; three `/identity/...` URLs with no page (e.g. `/identity/guides/analytics/analyzing-login-attempts/`).
- Recheck on Docusaurus v4: version data may move.

