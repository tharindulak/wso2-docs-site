# Docusaurus tree format decisions

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharinduj
Blocked by: 01

## Question

From the "needs a format decision" list in [What the docs site's docusaurus source kind needs](01-docusaurus-source-kind.md), decide the format of the generated `docusaurus/` tree: source of truth for versions (lock `versions:` or `versions.json`); shared or per-version `static/`; partials location and whether they may carry front matter; a redirects file in the tree (carrying the MkDocs `redirect_maps`); per-page `@site` imports or globally registered components; edit links (pointing at `en/` until cutover); strict compile mode instead of the quiet CommonMark fallback; JSON-only sidebars; relative `.md` links versus absolute routes; number prefixes. Also decide where the HTML allow-list runs for `docusaurus` sources. Size input: converted output is about 4.2 GB with per-version image copies, against 4.6 GB for `en/` ([Clone the fork and record a conversion baseline](04-clone-and-baseline.md)); keeping both trees until cutover makes this the deciding factor. Breakdown: 0.06 GB text, 3.6 GB binaries of which 1.2 GB unique by content; git dedups identical blobs, so history grows far less than the checkout.

## Answer

Decided with the user, 2026-10-13 (images by file path chosen explicitly; the rest "go with your recommendations").

1. **Images and attachments: shared by file path.** Stored once in `docusaurus/assets/…` when the same path has identical content across versions; referenced by relative paths so the build bundles them and fails on a missing file. Where versions disagree, the newest version using the path keeps the plain path and older variants go to `assets/_versions/<v>/…`. Shared assets are immutable: the CI check rejects changes to an existing shared file, so a new screenshot is a new file. Sample `.war` attachments are treated the same way. Measured effect: 3.46 GB to 1.33 GB (599 of 6,016 paths differ between versions).
2. **Versions:** the lock file's `versions:` is the source of truth for what the site publishes; the converter generates `docusaurus/versions.json` and a check fails when the two disagree.
3. **Partials:** `docusaurus/docs/_partials/` (and the versioned equivalent where needed), no front matter. Fix `_` files being listed in `pages.json`.
4. **Components:** registered globally by the docs site (MDXComponents); pages import nothing except partials.
5. **Redirects:** MkDocs `redirect_maps` become `docusaurus/redirects.json` (from, to) in the tree, owned by writers after cutover.
6. **Edit links:** until cutover the converter sets each page's edit link to its MkDocs source in `en/`; after cutover, the MDX file. The docs site stops overwriting edit links for `docusaurus` sources.
7. **Strict compile:** for `docusaurus` sources a page that fails MDX compile fails the build; no CommonMark fallback.
8. **Sidebars:** JSON only; JS sidebars forbidden.
9. **Links:** internal links are relative `.md` file links; filename number prefixes are forbidden.
10. **Allow-list:** the remark plugin from [Locking down authored MDX](03-mdx-authoring-risks.md) runs in both the fork's CI check and the docs-site build for `docusaurus` sources.

- 2026-10-14: authored pages become `.mdx` (all versions) with no CommonMark pages: decided on [Should authored pages be .mdx or .md?](../../wso2-docs-authoring-components/issues/03-md-or-mdx.md); applied in that map's tree rewrite.
