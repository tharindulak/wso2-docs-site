# 10 How status front matter reaches the site (researched 2026-10-14)

Ticket: Identity Platform writers mark a feature's lifecycle status (Beta / Preview / GA / Deprecated) in the MkDocs source before cutover, using a front-matter field and a small section-level convention. The docs site (Docusaurus 3.10.2) must show a badge on the page title, in the sidebar and on a section, and must collect deprecations on a central Deprecations page.

Sources: this repo at `docs-is-migrate` c87d228 (line numbers below are for that commit), installed `node_modules/@docusaurus/*` 3.10.2 (read from the `docs-is-migrate` worktree, because this worktree has no `node_modules`), the migrated tree `/Users/admin/Documents/wso2/git/docs/docusaurus/` (branch `docusaurus-migration`, ce627dded), the generated pages in the `docs-is-migrate` worktree, the MkDocs sources in `/Users/admin/Documents/wso2/git/docs/en/`, and official docs, changelogs and GitHub repos fetched on 2026-10-14. **[inference]** marks my own reasoning. **[unverified]** marks claims I could not confirm in a primary source. Planning input only: nothing here has been built or tested.

## TL;DR

- **MkDocs path drops unknown front matter.** `KEEP_FRONT_MATTER` (`docs-site/packages/docs-converter/src/page.ts:15`) is an allow-list. `status` and the other new fields are lost for `mkdocs` and `mkdocs-merge` sources and, therefore, in the migrated tree, because `writeDocusaurusTree` copies the converted output as is. The Docusaurus-kind path (`prepareDocusaurusDocs`, `site.ts:685`) keeps every key. Fix: extend the allow-list with validation (one place), and decide the Cloud-vs-self-hosted merge rule (`site.ts:567`, Cloud wins today).
- **Use Material's field name: `status` (single string).** It is inert in docs-is today, because Material 9.1.2 predates navigation status (9.2.0) and docs-is overrides `partials/nav-item.html`. It works in MkDocs later only after an upgrade plus an override merge. Absent means GA.
- **Sidebar:** Docusaurus 3.10.2 applies the front-matter fields `sidebar_class_name` and `sidebar_custom_props` over `sidebars.json` items (`plugin-content-docs/lib/props.js:24-26`). Derive them from `status` in `markdown.parseFrontMatter` and style with CSS. No swizzle of `DocSidebarItem/Link` (unsafe, and changed in patch release 3.10.2).
- **Title:** add the badge in the already-wrapped `site/src/theme/DocItem/Content`, which already reads `useDoc().frontMatter`. Optionally use an `h1` mapping in the ejected (safe) `MDXComponents`. Keep the badge outside heading text, because heading ids and the TOC include JSX text.
- **Deprecations page:** build an index in `scripts/build-content.mjs`, not with `allContentLoaded`, which is undocumented, types other plugins' content as `unknown`, and has the highest v4 risk.
- **Section level:** a block under the heading, the pattern GitLab, Google and Cloudflare all use. Map a custom admonition type (`!!! beta`, `!!! deprecated`) to a site component.
- No new dependencies are needed. A Material upgrade would be a docs-is dependency change needing its own review.

## 1. Does `@wso2/docs-converter` keep unknown front-matter fields?

| Path | Unknown fields kept? | Where |
|---|---|---|
| (a) MkDocs sources converted at build time (`kind: mkdocs`, `mkdocs-merge`) | **No.** An allow-list drops them. | `docs-site/packages/docs-converter/src/page.ts:15`, applied at `page.ts:112-114` |
| (b) Docusaurus-kind sources (`prepareDocusaurusDocs`, the migrated Identity tree) | **Yes.** All keys are spread through. | `docs-site/packages/docs-converter/src/site.ts:677`, `:685`, `:688` |
| (c) Migration writes the tree (`writeDocusaurusTree`, `scripts/migrate-docusaurus.mjs`) | **Whatever (a) produced.** The tree writer copies front matter verbatim, but its input is (a)'s output, so the allow-list has already run. | `docs-site/packages/docs-converter/src/tree.ts:116-175`; `docs-site/scripts/migrate-docusaurus.mjs:28`, `:45` |

### (a) MkDocs sources: the allow-list

- `page.ts:15`: `const KEEP_FRONT_MATTER = ['title', 'description', 'keywords', 'sidebar_label', 'sidebar_position', 'slug', 'tags', 'image'];`
- `page.ts:112-114`: the output front matter starts empty. Only `KEEP_FRONT_MATTER` keys are copied from `{ ...opts.pageData?.frontMatter, ...data }`. Then the converter adds its own keys: `title` from the first H1 or a fallback (`:115`, `:125-130`), `hide_table_of_contents` for API pages (`:119`), `mkdocs_template` (`:131`), `deployment_options` (`:132`), `custom_edit_url` (`:133`), `quick_start` (`:135`) and `mdx.format` (`:136`). The result is serialized with `yaml.dump` (`:145`).
- The front matter comes from the page file before templating. `render.ts:55-72` (`splitPageData`) parses it with `yaml.JSON_SCHEMA` and strips it from the body. `render.ts:75-78` (`readPageData`) returns it. Call sites: `site.ts:425` (single MkDocs site) and `site.ts:565-567` (merged Cloud + self-hosted).
- **Merged pages: Cloud wins.** At `site.ts:567`, `{ ...sData.frontMatter, ...cData.frontMatter }` means that when the Asgardeo (Cloud) and Identity Server copies of a page both set `status`, the Cloud value is kept and the self-hosted value is lost. **[inference]** Lifecycle status can differ between Cloud and self-hosted, for example GA in Cloud and Preview in IS 7.2. A single merged `status` cannot express that unless the field is per-deployment-option, for example `status: { WSO2 Cloud: ga, Self-hosted: preview }`, or the merge reports a conflict.
- YAML parse errors are silent. `page.ts:22` and `render.ts:61` fall back to `{}` on a `yaml.load` error, so a page with a malformed front-matter block loses all its fields without a warning. A status field typed wrongly would vanish quietly.
- Section-level syntax in the body is also affected:
  - `syntax.ts:240-241` removes every attr-list (`{: .class }`, `{.class}`, `{#id}`), counting them in `stats.attrLists`. A heading convention such as `## Foo {.status-beta}` would be dropped, and so would an explicit `{#anchor}`.
  - `syntax.ts:49-56` turns `!!! <type> "Title"` into `:::<mapped>[Title]`. An unknown type such as `preview` or `deprecated` falls back to `note` (`ADMONITION[...] ?? 'note'`, `:56`), so the title survives but the status meaning is lost.
  - `<span>` and `<div>` are on the JSX allow-list (`syntax.ts:12-17`). The HTML policy (`html-policy.ts:52-89`) blocks only forbidden tags, event handlers and unsafe URLs, so `class` and `data-*` attributes on a `<span>` or `<div>` pass through.

Evidence from real data: the front-matter keys in the 1,065 pages of `/Users/admin/Documents/wso2/git/docs/docusaurus/docs/` are exactly the allow-list plus the converter-added keys: `title` 1025, `deployment_options` 1025, `custom_edit_url` 1022, `mkdocs_template` 382, `hide_table_of_contents` 178, `description` 176, `quick_start` 24, `mdx` 15, `tags` 5, `slug` 5, `pagination_prev`/`pagination_next` 3. The pagination keys come from the redirect stub at `docs-site/scripts/build-content.mjs:33`. The generated `docs-site/generated/docs/identity/` (1,065 pages) has the same set. For example, `en/asgardeo/docs/apis/agent-share-rest-api.md:2` has `template: templates/redoc.html`, and in the tree it becomes `mkdocs_template: redoc` (`docusaurus/docs/apis/agent-share-rest-api.md:7`).

### (b) Docusaurus-kind sources: everything is kept

- `site.ts:677`: `splitFrontMatter(raw)` (`page.ts:18-24`, also `JSON_SCHEMA`).
- `site.ts:685`: `const front = { ...data, deployment_options: data.deployment_options ?? deploymentOptions, ...(edit && !data.custom_edit_url ? { custom_edit_url: edit } : {}) };`, so every key the page has is kept.
- `site.ts:686-688`: partials (any path segment starting with `_`) are written **without** front matter. A status set in a partial is dropped. This is correct, because Docusaurus ignores front matter in partials.
- `site.ts:697`: the CommonMark fallback also keeps `front`.
- Caveat: front matter is round-tripped through `JSON_SCHEMA` and `yaml.dump`. An unquoted date (`deprecated_since: 2026-03-01`) stays a string, and `yaml.dump` quotes it. Docusaurus itself parses front matter with gray-matter and js-yaml's default schema (`node_modules/@docusaurus/utils/lib/markdownUtils.js:18`, `:162`), which would make an unquoted date a `Date`. **[inference]** Because the round trip quotes everything, the site always receives strings, which is the safer outcome. Version-like values (`7.2.0`) are strings under both schemas, but `7.2` is a number unless quoted. The field contract should say "quote versions".

### (c) The migration tree writer

- `scripts/migrate-docusaurus.mjs:28` runs `build-content.mjs --partials` for every version, which means path (a), allow-list included. `:45` points `docsDir` at `generated/docs/<versionId>`, and `:50` calls `writeDocusaurusTree`.
- `tree.ts:126-175` reads each converted page and rewrites only three things: component imports (`withoutComponentImports`, `:79-86`), link and asset targets (`:136-173`, in the body via `outsideCode`), and pinned-commit edit URLs in the front matter (`editOnBranch`, `:89-93`, `:174`). Front-matter keys are neither added nor removed. `pageUrl` (`:66-73`) reads `slug` with a regex.

### What it would take to pass `status`, `deprecated_since`, `removal`, `replacement` through all three paths

1. **(a)** Extend `KEEP_FRONT_MATTER` (`page.ts:15`) with the agreed keys. A better option is a validated block: copy the keys only when their values match a small schema (enum for `status`, quoted version or ISO-date strings, `replacement` as a relative doc link or a plain string). Report bad values in the page report the way other `PageError`s are reported, so typos do not pass silently. That is one line plus a validator and tests in `docs-site/packages/docs-converter/test/`.
2. **(a, merged)** Decide the merge rule at `site.ts:567`: Cloud wins (today), self-hosted wins, or a per-option object. **[inference]** A per-option object fits the existing `deployment_options` model best.
3. **(b)** Nothing is needed to keep the fields. Optionally validate with the same schema here (`site.ts:685`), so the post-cutover tree is held to the same contract.
4. **(c)** Nothing is needed. Re-run `scripts/migrate-docusaurus.mjs` after (a) changes, and the tree picks the fields up.
5. **Derived Docusaurus fields** (for the sidebar, §3.2): either the converter (a and b) writes `sidebar_class_name` and `sidebar_custom_props` from `status`, or the site derives them at build time with `markdown.parseFrontMatter` (§3.2). The second option keeps the source to one field and touches no converter code.
6. **Section level:** choose a MkDocs-visible syntax the converter maps to an MDX component (§5). attr-list heading classes would need `syntax.ts:240-241` changed, and unknown admonition types would need `syntax.ts:3-9`/`:56` changed.

The converter's output contract is versioned (`source.ts:8`, `CONTRACT_VERSION = 1`). **[inference]** New optional front-matter keys do not change the layout, so a version bump should not be needed. Confirm against the conversion contract (`docs-site/README.md:103` points to `.scratch/wso2-docs-site/issues/13-conversion-contract.md`).

## 2. MkDocs Material and unknown front matter

### 2.1 MkDocs core keeps unknown keys and hands them to the theme

- MkDocs: "The key/value pairs are passed by MkDocs to the page template". Only `template` and `title` are used by MkDocs itself. Other keys matter "if a theme includes support" (https://www.mkdocs.org/user-guide/writing-your-docs/#yaml-style-meta-data). **[inference]** An unknown key such as `deprecated_since` is harmless in MkDocs: it is never rendered unless a template reads `page.meta.<key>`.
- docs-is already relies on this. The theme override `en/theme/material/` (used through `custom_dir`: `en/asgardeo/mkdocs.yml:27`, `en/identity-server/is_common.yml:24`) reads `page.meta` keys such as `heading`, `read_time`, `what_you_will_learn` and `prerequisites`. In the sources (`en/asgardeo/docs`, `en/identity-server/next/docs`, `en/includes`), the front-matter keys in use are `template` 605, `heading` 297, `read_time` 212, `heading_meta` 80, `search` 7, `tags` 6, `title` 5, and one or two each of `description`, `what_you_will_learn`, `technology_used`, `source_code`, `seo`, `reading_time`, `prerequisites`, `pageClass`, `date` and `author`. Except `title`, `description` and `tags`, the converter drops all of these (§1 (a)). `template` survives only as the derived `mkdocs_template`, and `quick_start` comes from a `<script>` literal, not from front matter. No page uses `status` today.

### 2.2 Material's page `status` (navigation status)

- Feature: front matter `status: new` (or `deprecated`). "The following status identifiers are already defined: `new`, `deprecated`". Custom identifiers are declared in `mkdocs.yml` under `extra: status: <id>: <tooltip>`, and "The identifier can only include alphanumeric characters, as well as dashes and underscores". A custom icon is set in `extra.css`. The docs page marks the feature "Minimum version 9.2.0" and "Experimental" (https://squidfunk.github.io/mkdocs-material/reference/#setting-the-page-status).
- Added in **9.2.0** (2023-08-21): "Added support for navigation status" (`CHANGELOG` at tag `9.2.0`, squidfunk/mkdocs-material).
- Rendering is **navigation only**, not the title. `src/partials/nav-item.html` at tag 9.2.0, lines 24-37 (`render_status`): `class = "md-status md-status--" ~ type`, with `title="{{ config.extra.status[type] }}"` as the tooltip when it is defined. Lines 54-57: `{% if nav_item.is_page and nav_item.meta.status %}`. The icons come from CSS custom properties in `src/assets/stylesheets/main/components/_status.scss:29-32`: `--md-status`, `--md-status--new`, `--md-status--deprecated`, `--md-status--encrypted`. A custom one is `--md-status--<id>`. The value must be a **single string**. A map (for example per deployment option) would produce a broken class name **[inference]**. Material has no section-level status.

### 2.3 Does docs-is's Material support it? **No**

- Pinned versions: `en/asgardeo/requirements.txt:8` `mkdocs-material==9.1.2` (`:1` `mkdocs==1.6.1`), and `en/identity-server/{next,7.3.0,7.2.0,7.1.0,7.0.0,versions}/requirements.txt:8` `mkdocs-material==9.1.2` (`:1` `mkdocs==1.5.3`). Older IS versions (5.9.0 to 6.1.0) pin `mkdocs-material==4.2.0`. CI installs these: `.github/workflows/release-docs.yml:41` uses `pip install -r en/asgardeo/requirements.txt`, and `pr-builder.yml:33` uses `pip install -r requirements.txt`.
- 9.1.2 is older than 9.2.0. At tag 9.1.2, `src/partials/nav-item.html` (171 lines) has no match for "status".
- docs-is also **overrides `partials/nav-item.html`** (`en/theme/material/partials/nav-item.html`, 341 lines, no `status` handling). So even after an upgrade to 9.2+, the status icon would not render until the `render_status` macro is merged into that override.
- **[inference]** Using Material's field name (`status`, string value, identifiers `new`/`deprecated` plus custom `beta`/`preview` declared in `extra.status`) costs nothing today. It is inert in MkDocs 9.1.2 and lights up only after (1) a Material upgrade to 9.2 or later and (2) a nav-item override merge. Both are changes to docs-is's build and theme, with their own regression risk across a large site. It is a dependency bump, and a supply-chain review should cover the new version. It is not required for the docs site.
- Mapping: Material has no `ga`. **[inference]** Treat a missing `status` as GA, as GitLab does ("Generally available features should not have a status", §4.1). Material's `new` is not a lifecycle stage. Do not use it for Beta or Preview.

### 2.4 How docs-is marks status today

Six admonitions in the shared sources, all of type `warning`:
- `!!! warning "Beta feature"`: `en/includes/guides/branding/branding-ai.md:4`, `en/includes/guides/authentication/login-flow-ai.md:4`, `en/includes/guides/flows/flow-ai.md:4`.
- `!!! warning "Deprecated feature"`: `en/includes/guides/branding/configure-ui-branding.md:132`, section level. Two others are `"Deprecated behavior"` (`en/includes/guides/authentication/oidc/token-validation-resource-server.md:202`) and ``"Deprecated `sub` attribute behavior in application access tokens"`` (`en/includes/guides/authentication/user-attributes/enable-attributes-for-oidc-app.md:74`).
- The Beta markers are inside Jinja conditionals: `en/includes/guides/flows/flow-ai.md:3-6` has `{% if product_name == "WSO2 Identity Server" and is_version == "7.2.0" %} !!! warning "Beta feature" … {% endif %}`. **Status varies by product and version, and today it lives in the shared include, not in the wrapper page.** Front matter in an include is not page front matter. The wrapper pages (`en/asgardeo/docs/guides/flows/flow-ai.md` is a one-line `{% include %}`) are per product and per version, so the page-level `status` belongs on the wrapper.
- IS already defines a deprecation lifecycle: **Planned, Deprecated, Retired** (`en/identity-server/next/docs/references/wso2-identity-server-feature-deprecation.md`, "Feature deprecation life-cycle"). Release notes list deprecations that have no page of their own (`en/identity-server/next/docs/get-started/about-this-release.md:344` "Deprecated features", for example TLS 1.0/1.1). **[inference]** A front-matter-driven Deprecations page would cover page- and section-scoped deprecations only. Release-note-only deprecations need either their own data entries or a link to that page. The status vocabulary should be reconciled with Planned/Deprecated/Retired.

## 3. Docusaurus 3.10.2: badge on the title, in the sidebar, and a Deprecations page

All paths below are under `docs-site/node_modules/@docusaurus/` (3.10.2) unless they start with `docs-site/site/`.

### 3.0 Unknown front matter reaches the client

- `plugin-content-docs/lib/frontMatter.js:16-43`: `DocFrontMatterSchema` is a Joi object with `.unknown()` (`:42`), so unknown keys are kept in doc metadata. `sidebar_class_name` (string, `:30`) and `sidebar_custom_props` (object, `:31`) are first-class.
- Types: `plugin-content-docs/src/plugin-content-docs.d.ts:464`: `frontMatter: DocFrontMatter & {[key: string]: unknown}`.
- This repo already depends on that. `docs-site/site/src/theme/DocItem/Content/index.js:9` reads `useDoc().frontMatter.deployment_options`, a non-standard key the converter writes.

### 3.1 Badge on the page title

How the title renders: `theme-classic/lib/theme/DocItem/Content/index.js` renders a synthetic `<h1>` only when the Markdown has no H1 of its own (`useSyntheticTitle`). Converted MkDocs pages keep their `# Heading` in the body, because the converter takes `title` from it (`page.ts:115`) but leaves it in place. So the visible title is usually an **MDX `h1`**, not the synthetic one.

| Option | How | Cost | Fragility / v4 risk |
|---|---|---|---|
| **A. Extend the existing `DocItem/Content` wrapper** (`docs-site/site/src/theme/DocItem/Content/index.js`) | Add `<StatusBanner status={fm.status} …/>` next to `<DeploymentLabel>` (`:13`). It renders as a box above the H1, or under it if CSS reorders it, like `.deployment-box` (`docs-site/site/src/css/site.css:19`). | Very low: one component plus CSS. The repo already wraps here. | `DocItem/Content` is **not** in theme-classic's swizzle config (`theme-classic/lib/getSwizzleConfig.js`). Unlisted components fall back to `unsafe` (`core/lib/commands/swizzle/components.js:87`). Wrapping uses `@theme-original`, so upstream changes still flow through. The risk is the `useDoc()` contract, which is public client API. The badge sits beside the title, not inside it. |
| **B. `h1` in the ejected `MDXComponents`** (`docs-site/site/src/theme/MDXComponents/index.js:12`) | Map `h1` to a component that renders `<Heading as="h1">{children}<StatusBadge/></Heading>` and reads `useDoc().frontMatter.status`. The MDX content renders inside the doc provider, so `useDoc()` works. | Low | `MDXComponents` is "eject: safe" (`getSwizzleConfig.js:304-310`) and `MDXComponents/Heading` is "eject/wrap: safe" (`:332-337`). Covers only the MDX H1, so the synthetic-title case also needs option A or C. A page with several H1s gets several badges. **[inference]** Put the badge outside the heading text (a sibling inside `<header>`, or `aria-hidden` with a visually hidden label) so heading ids, the TOC and search titles are unchanged. |
| C. Wrap or eject `DocItem/Layout` | Same as A, one level up. | Low | Also unlisted, so `unsafe`. No advantage over A here. |

Recommendation: A for the box. If the badge has to sit on the title line, add B. Both read a single `status` field.

Accessibility and search: the site search indexer skips `.deployment-box` (`docs-site/scripts/search-index.mjs:52`, `SKIP_CLASS`). A status box needs the same treatment, or it should be indexed on purpose as a facet. The precedent for a facet is `<meta name="wso2:deployment">` at `DocItem/Content/index.js:12`.

### 3.2 Badge in the sidebar

How this repo builds sidebars:

- MkDocs kinds: `nav.ts:15-38` turns `nav:` into `{type:'doc', id, label}` and category items, written to `generated/sidebars/<versionId>.json` (`scripts/build-content.mjs:244`).
- Docusaurus kind (Identity): the tree's `sidebars.json` is loaded as is (`site.ts:719-721`) and written unchanged (`build-content.mjs:71-79`). `normalizeSidebar` (`sections.ts:26-36`) keeps item fields (`{ ...item }`).
- Each version is its own docs plugin instance whose `sidebarPath` is that JSON (`docs-site/site/docusaurus.config.js:35-52`).

Do the front-matter fields survive? Yes, and they win over the sidebar file:

- `plugin-content-docs/lib/props.js:24-26` (`toSidebarDocItemLinkProp`): `label: frontMatter.sidebar_label ?? item.label ?? title`, `className: frontMatter.sidebar_class_name ?? item.className`, `customProps: frontMatter.sidebar_custom_props ?? item.customProps`. Explicit `doc` items in `sidebars.json` therefore pick up a page's `sidebar_class_name` and `sidebar_custom_props` with no sidebar change.
- Categories: a category whose `link` is a doc gets `customProps` from that doc's `sidebar_custom_props` (`props.js:61-68`, `:74`, `:80`). `className` is not inherited, so a status class on a category must be set on the sidebar item.
- Autogenerated sidebars do the same (`sidebars/generator.js:94`, `:145-146`).
- Neither field is used anywhere in the tree today (both counts are 0).

| Option | How | Cost | Fragility / v4 risk |
|---|---|---|---|
| **A. `sidebar_class_name` + CSS only** | `status: beta` becomes `sidebar_class_name: status-beta`. CSS such as `.menu__list-item.status-beta > .menu__link::after { content: "Beta"; … }`. | Lowest: no swizzle, no JS. | Depends only on the documented front-matter field and the stable `menu__*` Infima classes. Weak points: CSS `content` text is not translatable and screen-reader support for it varies, and a category needs the class in the sidebar file. |
| B. `sidebar_custom_props` + wrap `DocSidebarItem/Link` | Wrapping cannot put the badge *inside* the `<a>`. The wrapper can only add siblings, so in practice you would **eject**. | Medium | `DocSidebarItem/Link` is unlisted in the swizzle config, so `unsafe`. Upstream changed it in a **patch** release: 3.10.2 "remove redundant sidebar label titles" (facebook/docusaurus#11966) touched `DocSidebarItem/Link/index.tsx` and `Category/index.tsx`. An ejected copy would have missed that silently. Highest upgrade cost. |
| C. Global-data lookup by `docId` | A plugin publishes `{docId: status}`. A swizzled Link looks it up. | Medium | Same swizzle risk as B, plus global data is loaded on every page (see §3.3). |

Where to derive `sidebar_class_name` / `sidebar_custom_props` from `status`:

- **Site-level hook `markdown.parseFrontMatter`** in `docs-site/site/docusaurus.config.js`. The config schema is at `core/lib/server/configValidation.js:110`, `:388`, and the docs plugin uses it at `plugin-content-docs/lib/docs.js:41-45`. Documented: "Gives you the ability to provide your own front matter parser, or to enhance the default parser" (https://docusaurus.io/docs/api/docusaurus-config, `markdown.parseFrontMatter`). Call `defaultParseFrontMatter`, then set `sidebar_class_name ??= 'status-' + status` and `sidebar_custom_props ??= { status }`. One place, no converter change, and it works for every source kind. Risk: `utils/lib/markdownUtils.js:160-161` carries "TODO Docusaurus v4: replace gray-matter by a better lib", so the default parser underneath may change in v4. The hook signature is documented API.
- Or in the converter (§1 step 5). That writes the derived fields into the tree, so the tree carries two fields that must agree.

### 3.3 A site-wide Deprecations page built from front matter

Constraints in this repo: one docs plugin instance per live version (`docusaurus.config.js:30-52`). Snapshot versions are built separately (`:29-33`), so a live-build page never sees them.

| Option | How | Cost | Fragility / v4 risk |
|---|---|---|---|
| **A. Pre-built index in `scripts/build-content.mjs`** | After conversion, scan `generated/docs/<versionId>/**/*.md` front matter (`splitFrontMatter` is already imported, `build-content.mjs:13`). Write `generated/deprecations.json` with rows `{product, section, version, docId, title, url, status, deprecated_since, removal, replacement}`. A `src/pages/deprecations.js` imports the JSON, or reads it from `customFields` the way `catalogue` is passed (`docusaurus.config.js:63-71`, `:98`). | Low to medium | Framework-independent. The weak point is the URL: the script has to reproduce Docusaurus permalinks (slug, `index`/`README`, `numberPrefixParser` differences at `docusaurus.config.js:49`). `tree.ts:66-73` `pageUrl` already does this for the tree. A broken-link check (`scripts/check-links.mjs`) would catch drift. Testable with `node --test` like the other scripts. |
| B. Small local plugin with `allContentLoaded` | `allContentLoaded({allContent, actions})` reads `allContent['docusaurus-plugin-content-docs'][versionId].loadedVersions[].docs[]` (each has `frontMatter`, `permalink`, `title`), then `actions.addRoute` plus `createData` for one `/deprecations/` page. | Medium | Exact permalinks and titles. `allContentLoaded` was added in 3.2.0 (facebook/docusaurus#9931, CHANGELOG). It is typed (`types/src/plugin.d.ts:133-136`) but **not documented** on https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis (checked 2026-10-14). `AllContent` is `unknown` per plugin (`plugin.d.ts:71-75`), so the plugin depends on plugin-content-docs' internal `LoadedContent` shape (`plugin-content-docs/lib/index.js:163-178`). Highest v4 risk of the three. |
| C. `setGlobalData` from a plugin | Same data published as global data, rendered by any page. | Medium | Documented warning: "Global data is... global: its size affects the loading time of all pages of your site" (lifecycle-apis page). Not worth it for one page. Use `createData` + `addRoute` (B) or a static import (A). |

Recommendation: A. It reuses code the repo already has, has no new dependency, is easy to unit-test, and is immune to Docusaurus internals. Add the link checker to catch URL drift. Note that A also sees snapshot versions' generated docs if they exist on disk. Decide whether the page lists Latest only (simplest and least confusing) or every supported version.

## 4. How others mark status at section level

### 4.1 GitLab: availability details and version history (Hugo shortcodes)

- **Source syntax**, placed under the H1 for page scope ("after the front matter") or "under the applicable section titles" for section scope (https://docs.gitlab.com/development/documentation/styleguide/availability_details/):
  ```
  {{< details >}}

  - Tier: Free, Premium, Ultimate
  - Offering: GitLab.com, GitLab Self-Managed, GitLab Dedicated
  - Status: Experiment

  {{< /details >}}
  ```
  "For status, choose one: `Beta`, `Experiment`, `Limited availability`". "Generally available features should not have a status." A lower heading repeats only what differs from its parent. A subheading that matches its parent gets no block.
- **Rendering** (`themes/gitlab-docs/layouts/_shortcodes/details.html` in gitlab-org/technical-writing/docs-gitlab-com at commit 40958c56): a `<div class="availability">` holding a `<ul>`, with the text before the first colon in bold ("**Status**: Beta"). It is a key/value box under the heading, not an inline badge.
- **Version history**, immediately after the heading and after any details block: `{{< history >}}` with a `-` list. Examples from the same page: "- [Introduced](…) as a [beta](…) in GitLab 15.7.", "- [Changed](…) from experiment to beta in GitLab 16.0.", "- [Generally available](…) in GitLab 16.10." It renders as a collapsible titled "History" (`_shortcodes/history.html`: "the same markup as 'Collapsible,' but with a pre-populated title").
- **Deprecations** (https://docs.gitlab.com/development/documentation/styleguide/deprecations_and_removals/): add "(deprecated)" after the title, then a GitLab-flavored alert `> [!warning]` with "This feature was [deprecated](…) in GitLab 14.8 and is planned for removal in 15.4. Use [feature X](…) instead." The block is wrapped in `<!--- start_remove The following content will be removed on remove_date: 'YYYY-MM-DD' -->` … `<!--- end_remove -->`. After removal the heading becomes "(removed)", and the page title becomes `title: Title (removed)`. The central deprecations page is **generated from YAML** in `data/deprecations` (gitlab-org/gitlab) with `bin/rake gitlab:docs:compile_deprecations`, not from page front matter. The sidebar label gets "(deprecated)" through a separate navigation MR.

### 4.2 Google Cloud: launch-stage notices

- **Stages** (https://cloud.google.com/products#product-launch-stages, fetched 2026-10-14): **Preview** ("ready for testing by customers … no SLAs or technical support commitments … intended for use in test environments only. The average Preview stage lasts about six months"), **General Availability**, **Deprecated** ("scheduled to be shut down and removed"). Early access, alpha and beta are marked "[Legacy]".
- **Rendering observed** (source syntax is internal to Google's DevSite and not public **[unverified]**):
  - Section level: under the H2 "Basic roles" on https://docs.cloud.google.com/iam/docs/roles-overview there is an `<aside class="beta">` with a bold "**Preview** — the Reader, Writer, and Admin basic roles" and the standard text: "This feature is subject to the "Pre-GA Offerings Terms" in the General Service Terms section of the Service Specific Terms. Pre-GA features are available "as is" and might have limited support. For more information, see the launch stage descriptions." The markup carries `track-type="commonIncludes"`, which suggests a shared include **[inference]**.
  - Page level: the title gets a suffix, "Sync from Google Groups (Preview)", plus an in-body `<aside class="note"><b>Preview:</b> …</aside>` (https://docs.cloud.google.com/gemini/enterprise/docs/connectors/connect-groups).
  - Sidebar: nav items get `class="devsite-nav-preview"` and an icon `<span class="devsite-nav-icon material-icons" data-icon="preview" data-title="Preview">` (same page, left nav).
- The pattern: one fixed legal sentence per stage, scoped by a short label ("Preview — <what>"), reused from an include so that the wording stays consistent.

### 4.3 Cloudflare: `Badge`, sidebar badges, deprecation notes

Source: cloudflare/cloudflare-docs, branch `production` at 1ea4d542 (2026-10-13).
- **Component** (`src/content/docs/style-guide/build-the-page/components/badges.mdx`): `<Badge text="Beta" variant="caution" />`. Variants are note, success, tip, caution, danger and default. "Badges are a built-in component provided by [Nimbus]… Use them to indicate a product is in beta."
- **Sidebar via front matter** (same file and `…/frontmatter/sidebar.mdx`, "Badges" section): `sidebar: badge: { text: Beta }` or `sidebar: badge: New!` for a link. `sidebar: group: badge:` in a group's `index.mdx` badges the group. "A 'Beta' badge is automatically added to sidebar links and groups whose URL matches a directory entry with a 'Beta' availability status. This badge is **not** controlled by frontmatter — it is derived from the product availability data associated with the entry in `src/content/directory/`."
- **Inline and section badges** (`…/components/inline-badge.mdx`): `### Beta <InlineBadge preset="beta" />`, with presets `alpha`, `beta`, `deprecated`, `early-access` and `legacy`. The guide **advises against** them: "Our current recommendation is to avoid inline badges, since they may hurt readability". Mention beta on the feature's main page with `<Badge>`. In running text write "(beta)" with no formatting. Instruction pages may include "(beta)" in the side nav.
- **Page banner** (`…/frontmatter/banner.mdx`): front matter `banner: { content, type }`, "Only use it to alert about disruptive situations and take note to remove it when applicable."
- **Deprecations** (`src/content/docs/style-guide/api-content-strategy/api-content-types/deprecated-apis.mdx`): required parts are the deprecated endpoint name, context, **replacement** and **end of life date** ("full month name, date, and year"). Notices are added to a central "API deprecations page by deprecation date". Before removal, the endpoint description gets "`<name>` will be deprecated on `<date>`. Use the `<alternative>` instead." The central page is curated content, not generated from front matter.

### 4.4 Takeaways for this ticket **[inference]**

- All three put the **section-level** marker **as a block directly under the heading** (GitLab details box, Google `aside`, Cloudflare page `Badge` and banner), not inside the heading text. Cloudflare's guide explicitly discourages inline heading badges. This also avoids the anchor and TOC churn in §6.
- Only Cloudflare drives the **sidebar badge from page front matter**. Google's mechanism is not public. GitLab adds "(deprecated)" to the navigation by hand.
- **Central deprecation pages** at GitLab and Cloudflare come from **separate structured data** (GitLab YAML) or curation, not from page front matter. Front matter alone misses deprecations that have no page.
- The fields every source requires for a deprecation are deprecated-in (version or date), planned removal (version or date) and replacement link. That matches `deprecated_since`, `removal` and `replacement`.

## 5. Proposed shape (planning input, not a decision)

**Page level (front matter on the wrapper page, per product and version):**
```yaml
status: deprecated            # beta | preview | deprecated; absent = GA (Material-compatible string)
deprecated_since: "7.2.0"     # quoted: version or ISO date
removal: "7.4.0"              # quoted: planned removal version or date
replacement: ../new-feature/  # relative doc link, URL-checked
```
- Converter (a): add the four keys to `KEEP_FRONT_MATTER` (`page.ts:15`) behind a validator, and report invalid values. For merged pages (`site.ts:567`), keep `status` when the Cloud and self-hosted wrappers agree. When they differ, emit `status` from Cloud plus a per-option map (for example `status_by_deployment`), and show the map on the page. The exact rule is a decision for the team.
- Site: in `docusaurus.config.js`, use `markdown.parseFrontMatter` to derive `sidebar_class_name: status-<id>` and `sidebar_custom_props: {status}`. Sidebar badge by CSS only. Page badge or box in the existing `DocItem/Content` wrapper, and optionally an `h1` in `MDXComponents`.
- Deprecations page: `build-content.mjs` writes `generated/deprecations.json` and a `src/pages/deprecations.js` renders it. Merge in a hand-curated list for release-note-only deprecations (§2.4).

**Section level (a block directly under the heading, as GitLab, Google and Cloudflare do):** MkDocs authors already write `!!! warning "Beta feature"`. Two candidates:
1. A dedicated admonition type: `!!! preview "Preview"`, `!!! beta "Beta"`, `!!! deprecated "Deprecated in 7.2.0. Removal in 7.4.0. Use [X](…)."` MkDocs renders it as an admonition, and a small `extra_css` rule styles the custom type in Material. The converter maps these types (`syntax.ts:3-9`, `:56`) to a `<SectionStatus status="…">` component registered in `MDXComponents` (pattern: `Applies`). Lowest friction for writers. Structured fields (since, removal) live only in the text, so section deprecations cannot be listed automatically.
2. An HTML block with `md_in_html`: `<div class="status" data-status="deprecated" data-since="7.2.0" data-removal="7.4.0" data-replacement="…" markdown>…</div>`. It is structured, so section deprecations could feed the Deprecations page, and it passes the HTML policy. It is harder for writers to type, and MkDocs needs CSS to show a badge.

**[inference]** Recommend 1 for Beta and Preview, and 2 or a page-level entry only where a section deprecation must appear on the central page. Do not use heading attr-lists (`{.status-beta}`): the converter strips them (`syntax.ts:240-241`) and they put the badge in the heading's anchor scope.

## 6. Risks and concerns

- **No new dependencies** are needed for any recommended option. Everything uses installed packages (`js-yaml` 4.3.2 in the converter, Docusaurus 3.10.2). Option §3.3 B uses an undocumented hook, not a new package.
- **Silent loss**: both front-matter parsers swallow YAML errors (`page.ts:22`, `render.ts:61`). Without validation, a typo removes a page's whole front matter, not just `status`. Recommend reporting parse errors.
- **Merge conflicts**: a merged page takes the Cloud front matter (`site.ts:567`). Status per deployment option needs a deliberate rule.
- **Anchor churn**: in Docusaurus 3.10.2 the heading id is built from heading text, and the filter skips only the MDX 1 `jsx`/`html` node types (`mdx-loader/lib/remark/headings/index.js:94`). An MDX 3 `mdxJsxTextElement` such as `<span>Beta</span>` therefore joins the slug (`foo-beta`), and the TOC serializes it as HTML (`mdx-loader/lib/remark/toc/utils.js:146-170`). Python-Markdown's toc slug likewise includes the text **[inference]**. Keep badges outside heading text, or deep links break.
- **Swizzle risk**: `DocItem/Content` (already wrapped) and `DocSidebarItem/Link` are `unsafe` by default. Prefer wrapping and CSS over ejecting, and pin and test on each Docusaurus bump. `future: { v4: false }` stays as set in `docusaurus.config.js:82`.
- **Content accuracy and commitments**: a Deprecations page publishes removal dates. **[inference]** Dates and replacements are product commitments, so they need product-owner approval, not only writer review, before they go live.
- **Security**: status values reach the DOM through React (escaped). A `replacement` field holding a URL should go through the same URL check as body links (`html-policy.ts` `unsafeUrl`) before it is rendered as a link.
