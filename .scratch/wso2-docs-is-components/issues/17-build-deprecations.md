# Build deprecation notices and the Deprecations page

Parent: [map](../map.md)
Type: task
Status: closed
Assignee: tharinduj
Blocked by: 15

## Question

AFK, test-first: build notices and the Deprecations page as decided in [How deprecation notices and the Deprecations page look](15-deprecation-look.md); tests; rebuilt Identity preview checked on the seed pages. Record the commit and pages affected.

Spec: the answer on [How deprecation notices and the Deprecations page look](15-deprecation-look.md). Deprecations index written by `build-content.mjs` (pages and `!!! deprecated` sections per version, plus `deprecations.yml` entries), rendered by a page per version; avoid `allContentLoaded`. Section treatment maps the `deprecated` admonition (today converted to a warning, `df008da`) to the deprecation style. `replacement` passes the converter's unsafe-URL check. Depends on the front-matter allow-list from [Build the lifecycle badge](16-build-lifecycle-badge.md); build after it or share that change.

## Answer

Built 2026-10-14 (AFK, test-first): `docs-is-migrate` commits `99b57c6` (fix) and `5115485` (feature).

- **Page notice:** box under the title (after the generated title on API pages, or the page's own h1): tag and since per deployment option, the shared one-line explanation, a "Use <title> instead →" button per resolved replacement (relative `.md` resolved against the page's doc id, server-rendered; a missing target drops the button and warns), and a "How deprecation works" link. Removal shown only when set ("Removal planned: X"); set nowhere today.
- **Section notice:** `!!! deprecated` converts to `:::deprecated[...]`, registered in each docs plugin's `admonitions.keywords`; the wrapped `Admonition/Types` draws the amber treatment, a tag only when the title lacks "deprecat", and a scope line (from a surrounding `<Applies>`, else the page's options). A remark plugin maps `:::warning[Deprecated …]` to the same type (the tree at fork `2dcedd3c` still carries the three seeded sections as warnings).
- **Deprecations page:** `build-content.mjs` writes `generated/deprecations/<versionId>.json` and a generated doc page at `<route>/deprecations/` with a sidebar entry after "Feature deprecation"; table as chosen; version tabs read `versions.json` and each version's `pages.json` in the browser (snapshot-safe). A version gets the page only if it has entries. `deprecations.yml` is read beside each `mkdocs.yml` (per option on merged versions) or at the docs root for Docusaurus sources. No `allContentLoaded`, no new global data.
- **Fix found on the way (`99b57c6`):** `rehype-valid-elements` turned Docusaurus's `mdxAdmonitionTitle` into literal text, so every admonition with markup in its title showed the default title plus a literal tag, site-wide. Fixed.
- Tests: converter 234/234, scripts and site 123/123. Content: 1,065 pages, 10 deprecations in Latest. Preview rebuilt; warnings identical. Verified notices on roles v1, user sharing (two dates), credential management; section notices on the three seeded pages; Latest Deprecations page 10 rows (7 pages, 3 sections). Older versions' indexes: 7.2.0 7 entries, 7.1.0 4, 7.0.0 4 (only Latest is in the preview build, so tabs show "Latest").
- Open: `migrate-docusaurus.mjs` does not copy a source `deprecations.yml` into the tree yet (none exists); section rows use the writers' titles ("Deprecated behavior"), which read poorly out of context; the self-hosted name map is per section (`identity` → "Identity Server").

