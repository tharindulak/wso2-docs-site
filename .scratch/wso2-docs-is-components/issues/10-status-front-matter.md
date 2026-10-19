# How status front matter reaches the site

Parent: [map](../map.md)
Type: research
Status: closed
Assignee: tharinduj
Blocked by: 

## Question

Writers will mark lifecycle status in the MkDocs source (map Notes). Find out, from this repo's converter and the installed Docusaurus 3.10.2:
- Does `@wso2/docs-converter` keep unknown front-matter fields for MkDocs sources (build-time conversion) and for Docusaurus-kind sources (the migrated Identity tree), or drop them? Where is the allow-list, if any?
- What does MkDocs Material do with unknown front-matter fields (ignored, or shown)?
- How can the site show a badge on a page title (theme slot such as `DocItem/Content`, reading front matter via `useDoc()`) and in the sidebar (`sidebar_custom_props`, `sidebar_class_name`, swizzling `DocSidebarItem/Link`)? Cost and fragility of each.
- How do GitLab, Google Cloud and Cloudflare mark status at section level (syntax and rendering), as input for a section convention.
Facts (2026-10-14, Identity Latest): Operational policies (`references/operational-policies.md`) define Beta features (10.3) and a deprecation window; 3 API pages say "(Deprecated)" in their title (end-user credential management, organization user share, roles v1); 3 sections use `:::warning[Deprecated …]`; "Feature Preview" is a Console toggle described in steps (e.g. self-registration flow); no page is marked Beta or Preview; front matter has no status field.

Research, 2026-10-14. Findings on branch `research/status-front-matter` (commit f6d3548), file `.scratch/wso2-docs-is-components/research/10-status-front-matter.md`.

## Answer

New front matter needs a converter change; everything after that already carries it. Gist (line numbers at `docs-is-migrate` c87d228; Docusaurus 3.10.2 installed):

- **MkDocs sources (build-time conversion) drop unknown fields:** `KEEP_FRONT_MATTER` (`page.ts:15`) keeps only title, description, keywords, sidebar_label, sidebar_position, slug, tags, image. YAML errors are swallowed (`page.ts:22`, `render.ts:61`), silently losing a page's front matter. On merged pages the WSO2 Cloud copy's front matter overwrites the self-hosted copy's (`site.ts:567`), so a stage that differs by deployment option would be lost.
- **Docusaurus-kind sources keep every field** (`site.ts:685`); `writeDocusaurusTree` copies front matter unchanged. So: extend the allow-list with value checks, settle the merged-page rule, report bad values, re-run the migration.
- **MkDocs Material:** unknown fields are harmless. Material's own page `status` (9.2.0+) shows an icon in the navigation only; docs-is pins 9.1.2 (Asgardeo, IS 7.x) and 4.2.0 (IS 5.9 to 6.1) and overrides `partials/nav-item.html`, so it is inert today. Using its name (`status`, one string) costs nothing.
- **Existing marking:** three shared includes in the source open with `!!! warning "Beta feature"`, inside product/version conditions; none render in Identity Latest. Release-note-only deprecations (e.g. TLS 1.0/1.1) have no page, so front matter alone will not catch every deprecation.
- **Title badge:** in the existing `DocItem/Content` wrapper via `useDoc()`; keep it outside heading text (a badge in the heading changes its anchor and TOC entry, `headings/index.js:94`).
- **Sidebar badge:** front-matter `sidebar_class_name` / `sidebar_custom_props` override `sidebars.json` items (`props.js:24-26`); derive them from `status` with the documented `markdown.parseFrontMatter` hook and draw with CSS. Do not eject `DocSidebarItem/Link` (unsafe; changed in 3.10.2).
- **Deprecations page:** an index written by `build-content.mjs` (`generated/deprecations.json`) rendered by a `src/pages` page, plus a hand-kept list for deprecations with no page. Avoid the undocumented `allContentLoaded` hook (v4 risk) and global data (loads on every page).
- **Section level:** all three reference sites put a block under the heading (GitLab `details` with Status, Google Cloud `<aside>` "Preview — scope", Cloudflare advises against heading badges). Map a custom admonition type (`!!! beta`, `!!! deprecated`) to a site component; do not use heading attribute lists (the converter strips them).
- **Flags:** no new dependencies needed. Removal dates and replacements on a public page are product commitments: product owners approve them first. A `replacement` URL must pass the converter's unsafe-URL check.

