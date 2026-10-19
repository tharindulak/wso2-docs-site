# Converter writes the docusaurus/ tree

Parent: [map](../map.md)
Type: task (AFK)
Status: resolved
Assignee: tharinduj
Blocked by: 01, 04, 05, 12

## Question

Add a converter command (`wso2-docs migrate` or similar) that writes docs-is's `docusaurus/` tree in Docusaurus's native layout: `docs/` (unified Latest with partials), `versioned_docs/version-<v>/` and `versioned_sidebars/` for 7.2.0 to 5.9.0 (inlined), `versions.json`, `static/`, and whatever metadata [What the docs site's docusaurus source kind needs](01-docusaurus-source-kind.md) assigns to the tree. Deterministic: running it twice on one SHA gives an identical tree. Test first. Commit the output on the fork's working branch in its own commit, with the command that made it. Follow the format in [Docusaurus tree format decisions](12-tree-format-decisions.md): shared `assets/` by file path, `_partials/`, `redirects.json`, generated `versions.json`, JSON sidebars, relative `.md` links, edit links to `en/`, no imports beyond partials. Partials per [Includes as MDX partials in Latest](05-includes-as-partials.md): only includes used by more than one Latest page (48 today), named after the include path, inlined elsewhere.

## Answer

Built 2026-10-13, test first (seams agreed with the user: partials through `convertMergedSites`, tree layout through `writeDocusaurusTree`; the glue script verified by running it).

- **Code:** Wso2-Cloud branch `docs-is-migrate` (worktree `.claude/worktrees/docs-is-migrate`, from `docs-site-search` at bbeaf10), commits 5d5c853 (partials), 29a3e1d (`writeDocusaurusTree`), 3307f6c (`scripts/migrate-docusaurus.mjs`, `build-content.mjs --partials`). Converter tests 132 to 145, all passing. Not pushed. The main checkout's uncommitted converter changes (8 files on `docs-site-search`) are not in this branch.
- **Command:** `DOCS_SITE_LOCK=<lock pinning wso2/docs-is to the commit> node docs-site/scripts/migrate-docusaurus.mjs identity <docs-is>/docusaurus [--edit-branch master]`. It runs `build-content.mjs --partials` for every version, then writes the tree. It refuses to replace a non-empty folder unless it carries the `.wso2-docs-tree` marker from an earlier run.
- **Output:** fork commit `88d0ab970` on `docusaurus-migration` (local, not pushed): `docusaurus/` with 10,795 files, 1.1 GB (assets 1.0 GB, static 20 MB, pages 55 MB). Repo history grew 957 MB to 982 MB because git stores identical blobs once.
  - 6,568 pages: Latest 1,025 plus 8 older versions in `versioned_docs/`; `versions.json` lists 7.2.0 to 5.9.0; 9 sidebars (JSON).
  - 40 partials in `docs/_partials/`, each imported by at least one page (the survey's 48 minus includes that render differently by page or sit inside one-option blocks).
  - Images and files: 3,205 shared by path, 760 older variants under `_versions/`. Only files pages reference are kept (unreferenced files such as `convert_links.sh` are dropped), which is most of the drop from 4.2 GB.
  - 8,535 links became relative `.md` links. 84 absolute links remain in Latest and about 640 in older versions; they point at pages missing from that version's source (for example `guides/users/attributes/manage-attributes/` in 7.2.0), already broken today.
  - No `@site`/`@theme` imports left; `redirects.json` holds 2,460 entries across 9 versions; 1,022 edit links open `wso2/docs-is/edit/master/en/...`.
  - Deterministic: two full runs gave identical trees (fingerprint compared).
- **Known gaps, for later tickets:** 16 pages are still `<Redirect>` stubs for excluded pages ([Make the excluded Identity pages convert](06-make-excluded-pages-convert.md)); `<Applies>` hiding and global component registration are docs-site work ([Docs site reads Identity Platform from the fork](10-docs-site-reads-fork.md)); the tree has not been built by Docusaurus yet, so import and image resolution is unproven until then.
