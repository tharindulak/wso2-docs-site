# 04 Can the site build read a linked page's title and description? (researched 2026-10-13)

Question: link cards in a page's closing section ("What's next?", "Next steps", "See also", "Learn more", "Related") need each
linked page's title and description. Can a remark plugin in our Docusaurus 3.10.2 build (one `@docusaurus/plugin-content-docs`
instance per version, `remarkPlugins: [remarkSteps]`) get them at build time?

Short answer: yes, three ways. The cheapest and most reliable is option 2: the remark plugin emits a small React component
and the component reads the title and description from the docs version metadata Docusaurus already ships to every doc
page. The data question matters more than the mechanism: only 17% of Identity pages have a `description` in front
matter, and almost none of the pages linked from closing sections do. Docusaurus fills the gap with an excerpt (first line
of body text), and that excerpt is what `DocCard` shows today.

Sources: installed Docusaurus source under `docs-site/node_modules/@docusaurus/` (version 3.10.2, read from the
docs-is-migrate worktree, which has `node_modules`), docusaurus.io docs, and the repo files named below. Measurements came
from a read-only Node script run over `docs-site/generated/docs/identity/` in the docs-is-migrate worktree (this worktree
has no `generated/`). Items marked **[inference]** are reasoning, not something read in a source. Nothing was built.

## 1. What the build does with links and metadata (facts every option depends on)

- **Plugin order.** `mdx-loader/lib/processor.js` (`createProcessorSync`) builds the remark chain as:
  `beforeDefaultRemarkPlugins`, frontmatter, directive, contentTitle, admonitions, headings, (emoji), toc, details, head,
  mermaid, transformImage, **resolveMarkdownLinks**, **transformLinks**, gfm, (comment), **user `remarkPlugins`**,
  unusedDirectives, codeCompat. docusaurus.io says the same: "The default plugins of Docusaurus would operate before the
  custom remark plugins", and "If you need to process the MDAST before the default plugins do, use the
  `beforeDefaultRemarkPlugins`" (https://docusaurus.io/docs/markdown-features/plugins).
- **Consequence: our plugin never sees a `.md` path.** `mdx-loader/lib/remark/resolveMarkdownLinks/index.js` visits
  every `link` and `definition` node whose URL is local and ends in `.md`/`.mdx`, and replaces `link.url` with the target's
  permalink (keeping `?query#hash`). By the time a `remarkPlugins` entry runs, `[Users](../users/index.md)` is already
  `/identity/guides/users/`. Unresolvable `.md` links are left as written (with an `onBrokenMarkdownLinks` warning).
  Only `link`/`definition` nodes are rewritten; an `href` attribute on a JSX element is not.
- **How `.md` links resolve** (`utils/lib/markdownLinks.js`, `resolveMarkdownLinkPathname`): `./x.md` and `../x.md` from
  the current file's directory; bare `x.md` from the file's directory, then the version content path, then `siteDir`;
  `/x.md` from the content path, then `siteDir`. The lookup is `sourceToPermalink`, a map of source file to permalink for
  **the current plugin instance only** (`plugin-content-docs/lib/index.js`, `resolveMarkdownLink` uses
  `getVersionFromSourceFilePath` for this instance's versions). A `.md` link into another product or version is not
  resolved by Docusaurus.
- **vfile.** `processor.js` creates `new VFile({ value, path: filePath, data: { frontMatter, compilerName } })`, so a
  plugin gets the absolute source path (`file.path`) and the page's front matter (`file.data.frontMatter`, which
  `remark-steps.ts` already reads). For a partial under `_partials/`, `file.path` is the partial's own path, so relative
  links in a partial resolve against the partial, not the page that imports it.
- **What a plugin cannot reach.** The docs plugin keeps `contentHelpers.sourceToDoc` (full doc metadata by source path,
  filled in `contentLoaded`, `lib/contentHelpers.js`), but it lives in the plugin's closure and is only passed to the
  link resolver. User remark plugins receive only their own options and the vfile. There is no supported API to read
  another doc's metadata from a remark plugin.
- **Title and description rules** (`plugin-content-docs/lib/docs.js`): `title = frontMatter.title ?? contentTitle ?? baseID`;
  `description = frontMatter.description ?? excerpt ?? ''`. The excerpt is `createExcerpt` in
  `utils/lib/markdownUtils.js`: the first non-empty body line after skipping imports, code fences and the H1, with HTML
  tags, emphasis, links, inline code, admonition markers and heading markers stripped. It is one source line, not one
  sentence. docusaurus.io documents the default as "The first line of Markdown content"
  (https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs).
- **Build cache.** The MDX loader's only extra webpack dependency is `__mdx-loader-dependency.json`, holding
  `{ options, versionsMetadata }` (`plugin-content-docs/lib/index.js`, `createMdxLoaderDependencyFile`; the loader calls
  `options.dependencies?.forEach(this.addDependency)` in `mdx-loader/lib/loader.js`). Webpack's persistent filesystem
  cache is on by default (`core/lib/webpack/base.js`). A remark plugin cannot register more dependencies. So anything a
  plugin bakes into page A from page B's file does **not** recompile A when only B changes, in dev or in a build that
  reuses `node_modules/.cache` **[inference from the two sources]**. A plugin option's JSON value is part of `options`, so
  passing something like an index hash as an option invalidates the cache for every page of that instance.

## 2. Where Docusaurus already exposes titles and descriptions at runtime

- **Version metadata prop (has title and description).** `plugin-content-docs/lib/routes.js` gives the version's root
  route the prop `version: toVersionMetadataProp(...)`. `lib/props.js` `toVersionDocsProp` maps **every doc in the
  version** to `{ id, title, description, sidebar }`. The theme puts it in `DocsVersionProvider`, read with
  `useDocsVersion()` (`lib/client/docsVersion.js`; exported from `@docusaurus/plugin-content-docs/client`). It is available
  during server-side rendering and on the client.
- **`useDocById(id)`** (`lib/client/docsUtils.js`) is `useDocsVersion().docs[id]`, and it **throws** if the id is missing.
- **`DocCard`** (`theme-classic/lib/theme/DocCard/index.js`): `CardLink` uses
  `description={item.description ?? doc?.description}` with `doc = useDocById(item.docId)`. `DocCardList` takes sidebar
  items. So `DocCard` descriptions come from the version prop above (front matter, else excerpt). `DocCard` takes a
  sidebar item shape, so a closing-section card would reuse its look, not the component as is **[inference]**.
- **Global data (no title or description).** `lib/globalData.js` `toGlobalDataDoc` keeps only `{ id, path, sidebar,
  unlisted? }` per doc. `useAllDocsData()` and `useActivePluginAndVersion()` read it. It maps a permalink to a doc id for
  any instance, but not to a title or description.
- **Size on our site** (read from an existing `.docusaurus/` in the docs-is-migrate worktree, left by an earlier run; may
  be slightly stale): the Identity Latest version prop `docusaurus-plugin-content-docs/identity/p/identity-d20.json` is
  574 KB, with 1,025 docs and 996 non-empty descriptions. `globalData.json` is 216 KB. Both are already loaded today, so
  option 2 adds no data.

## 3. Measurements: Identity Platform Latest (`generated/docs/identity/`)

Method: parse front matter with js-yaml; treat files under a `_`-prefixed folder as partials and files rendering
`<Redirect>` as stubs; find closing sections by headings (`##`/`###`/`####` "What's next", "Next steps", "See also",
"Learn more", "Related", "Further reading") plus `:::info[Related topics]`, `:::note|tip|info[Learn more]`,
`<summary>What's next?</summary>`, `**Related topics**` and an unconverted `!!! info Related topics`; extract Markdown
links and `href`s; resolve `.md` links as Docusaurus does and `/identity/...` URLs via slug or file path.

**Front matter `description`**

- 1,065 `.md` files: 1,022 pages, 40 partials, 3 redirect stubs. Every page has `title`.
- **176 of 1,022 pages (17%) have `description`.** 162 are in `apis/` (183 pages), 12 in `references/`, 1 in `guides/`
  (386 pages), 1 in `tutorials/`. `complete-guides/`, `deploy/`, `get-started/`, `quick-starts/`, `sdks/`: none.
- Length: min 21, median 115, p75 200, max 271 characters. 136 distinct values for 176 pages; the duplicates are API pages
  (for example 3 pages share "This document specifies a User Account Association Management RESTful API ...").
- Quality: API descriptions are mostly OpenAPI boilerplate, often cut with "..." ("The Action Management REST API
  provides a comprehensive interface ... across various workflows..."), some with typos ("WSO2 WSO2 Identity Platform",
  "RESTFull"), some only a name ("SCIM 2.0 Roles v1 API"). The few hand-written ones are good: "Learn how to add user
  authentication to your React application with a clean, component-driven pattern."
  (`tutorials/react-authentication-tutorial.md`).

**Docusaurus excerpt (the fallback when there is no `description`)**

- Pages with neither a description nor an excerpt: 26 of 1,022 (mostly API pages that are only `<ApiReference>`, plus a
  few index pages). Pages without an excerpt: 200, most of them API pages that do have a description, so the two cover
  each other.
- Excerpt quality is usually acceptable for a card, for example "Logging is one of the most important aspects of a
  production-grade server. ..." (`deploy/monitor/monitor-logs.md`). Weak cases: it ends with a colon (27 pages, for
  example "... grouped as follows:"), it is the first source line of a hard-wrapped paragraph and so stops mid-sentence
  ("... who interact with your" on `guides/users/index`), or it is a heading-like line ("Try a sample app",
  `index.md` gives "- Get started"). 132 excerpts exceed 300 characters, so cards need a line clamp. In the version
  prop, 145 of 996 descriptions do not end in sentence punctuation.

**Closing sections**

- 71 closing sections: 56 headings and 15 admonitions, details or bold labels. They are on 59 distinct pages, plus 3 in
  partials. Some pages repeat a section inside `<Applies to="WSO2 Cloud">` and `<Applies to="Self-hosted">` blocks (for
  example `guides/authentication/conditional-auth/acr-and-amr.md`), so a plugin must look inside JSX containers, as
  `remark-steps.ts` does.
- **How links are written**: 149 links. 126 are relative `.md` paths (85%), 19 absolute external URLs (13%, for example
  wso2.com library articles in `deploy/compliance/gdpr.md`), 3 root-relative URLs (`/identity/guides/...`, left by the
  converter's site-link rewrite), and 1 in-page anchor. There were no cross-product or cross-version links in this sample.
- **Resolution**: 125 of the 148 non-anchor links (84%) resolve to an Identity page. The rest are the 19 external URLs,
  one broken `.md` link (`manage-organizations.md` in `guides/organization-management/organizations-overview.md`) and
  3 root-relative URLs with no page (for example `/identity/guides/analytics/analyzing-login-attempts/`).
- **Targets with a front-matter description: 2 of 125 links.** Only one closing section
  (`guides/users/user-stores/configure-user-stores-for-scim2.md`) links only to pages with a description.
- **Targets with a Docusaurus description (front matter or excerpt)**: of the 97 unique linked pages without front
  matter, 95 have an excerpt. The 2 without are `references/oid4vci.md` and `references/concepts/oid4vci.md`. So about
  98% of resolved card targets get some description, almost all of it excerpts.
- Shape: most sections are a bullet list of one link with an optional " - explanation" after it. Some are numbered
  procedures with links inside sentences (`deploy/security/keystores/index.md`) or prose bullets ("Learn about
  [managing the environments of your SDLC](...)"). Only some sections suit cards, so the plugin needs a strict rule, such
  as list items whose first child is a single internal link.

## 4. Options

### Option 2 (recommended): the plugin emits a component; the component reads the version metadata

- **How**: in `remarkPlugins` (after link resolution), find a closing section and replace a qualifying list with an
  `mdxJsxFlowElement` such as `<LinkCards>`. Keep the original list as its children so it is the fallback. Register
  `LinkCards` in `site/src/theme/MDXComponents/index.js` beside `Applies` and `Tabs`. At render time, take each link's
  resolved `href`, map it to a doc id through this instance's global data (`useActivePluginAndVersion()` or
  `useAllDocsData()`, path to id), then read `useDocsVersion().docs[id]` for `title` and `description`. Do not call
  `useDocById`, which throws on a miss.
- **Link forms handled**: relative `.md` (already a permalink by then), root-relative URLs into the same version, and
  `slug` overrides or number prefixes, because the permalink is the key.
- **Cost**: no new build data or extra file reads. The version prop and global data are already loaded on every doc page.
  It adds one small component and a lookup per card. Server-side rendering works because the providers wrap doc pages,
  so the cards are in the static HTML **[inference: DocsVersionProvider is set by the docs root route component]**.
- **Ordering constraints**: none beyond the default. User `remarkPlugins` already run after link resolution and the TOC.
- **Freshness**: correct after any change. Metadata comes from `loadContent` on every run, not from the cached MDX output.
- **Same source of truth** as `DocCard`, the page's `<meta description>` and sidebar labels. Title is `frontMatter.title ??
  H1 ?? id`. It uses the doc title, not the sidebar label.
- **Failure modes**: links to another version or product are not in `useDocsVersion()`, so render a plain card with the
  link text and no description (global data could still confirm the target exists). External URLs: plain card or leave
  as a list. Path normalisation: global data `path` is the raw permalink and our site uses `trailingSlash: true`, so
  compare with trailing slashes stripped **[inference; verify against a built page]**. Pages rendered as plain Markdown
  (`format: md`): `processor.js` passes `mdxJsxFlowElement` through `rehype-raw` in md mode, so an emitted JSX node should
  still render. No Identity page sets `format: md`, but the MkDocs fallback pages that `rehype-valid-elements` handles
  should be checked in a prototype **[unverified]**.

### Option 3: a pre-built index written by `build-content.mjs`

- **How**: after conversion, write for example `generated/link-meta/<versionId>.json` holding
  `{ "<page path>": { title, description } }`. Key it the way `scripts/versions.mjs` `pagePath()` already keys
  `pages.json` (slug, else file path with `index`/`README` as the folder). Pass the file to the remark plugin as an option.
  The plugin loads it once per processor (Docusaurus caches processors per options, `processor.js` `ProcessorsCache`),
  strips the version route from each resolved `href`, and writes title and description into static attributes or HAST.
- **Link forms**: same as option 2 (works on resolved permalinks). It can also cover other versions and products if the
  index spans them, which option 2 cannot.
- **Cost**: one pass over pages that `build-content` already walks, and about 1,000 entries per version (roughly 0.2 to
  0.3 MB of JSON for Identity) **[estimate]**. No runtime cost.
- **Ordering constraints**: the content step must run before the site build (already enforced: the config throws without
  `generated/manifest.json`). Snapshot builds (`scripts/snapshots.mjs`) must include the index in the snapshot key, or a
  snapshot could carry another version's metadata. `DOCS_SECTIONS` quick builds are unaffected.
- **Freshness**: to avoid stale cards from the webpack cache (section 1), pass a hash of the index as a plugin option so
  `__mdx-loader-dependency.json` changes and the version recompiles. If someone edits a file in `generated/` without
  rerunning the content step, the index is stale.
- **Failure modes**: to match Docusaurus it must copy its rules (title fallback to the H1, description fallback to
  `createExcerpt`). Using front matter only would give 2 of 125 targets a description. Copying `createExcerpt` means
  importing `@docusaurus/utils` into the scripts (it is installed, but not a direct dependency) or keeping a copy that can
  drift. Number-prefix stripping (`numberPrefixParser`, on for `kind: docusaurus` sections) must also match, or keys miss.

### Option 1: the remark plugin reads the target file from disk

- **How**: resolve each link against `file.path` and read the target's front matter and first line.
- **Ordering constraint (decisive)**: in `remarkPlugins` the `.md` path is already gone (section 1), so this only works
  from `beforeDefaultRemarkPlugins`. There it runs before headings, the TOC and link resolution. It should only annotate:
  keep the `link` node inside the emitted JSX so `resolveMarkdownLinks` still rewrites it, and store title and
  description as attributes. Root-relative `/identity/...` URLs (3 here) cannot be mapped to a file without an index
  (option 3).
- **Cost**: about 150 small file reads for Identity Latest, which is negligible. It must copy Docusaurus's title and
  excerpt rules, as in option 3, and resolve bare `x.md` the way Docusaurus does (current dir, then content root).
- **Freshness**: the worst of the three. The webpack cache does not know page A depends on page B, so cards go stale in
  dev and in cached builds until A changes or the cache is cleared.
- **Security**: the plugin reads files chosen by content. Confine resolved paths to the version's content directory,
  including the real path after symlinks (as `containedFile` in `build-content.mjs` already does). The risk is low because
  sources are pinned in the lock file, but a crafted `../../..` link could otherwise read any `.md` file on the build host
  into page HTML.
- **Partials**: resolve relative to the partial (`file.path`), which matches Docusaurus.

### Comparison

| | Option 2: runtime component | Option 3: pre-built index | Option 1: read from disk |
|---|---|---|---|
| New data or files | none | 1 JSON per version | none |
| Sees `.md` and URL links | yes (resolved permalinks) | yes (resolved permalinks) | `.md` only, from `beforeDefaultRemarkPlugins` |
| Cross-version or cross-product targets | no (plain fallback) | yes, if indexed | yes, for relative paths |
| Matches Docusaurus title and description | exactly (same data) | only if rules are copied | only if rules are copied |
| Stale after a target edit | no | no, if hash is passed as option | yes (webpack cache) |
| New dependency | none | `@docusaurus/utils` direct (optional) | `@docusaurus/utils` direct (optional) |

## 5. Dependencies, security and supply chain

- Option 2 needs no new package; `@docusaurus/plugin-content-docs/client` is part of the installed 3.10.2.
- Options 1 and 3 would either add `@docusaurus/utils` as a direct dependency of `@wso2/docs-converter` or the scripts
  (already installed transitively; pin it to 3.10.2 to match core) or copy `createExcerpt`, which is MIT-licensed and
  compatible with Apache-2.0 but needs attribution and can drift on a Docusaurus upgrade.
- `useDocsVersion` and the version prop's `docs` map are exported but have a "TODO Docusaurus v4 breaking change? expose
  version metadata as route context instead of props" comment in `routes.js`. Recheck this when moving to v4 (the config
  keeps `future: { v4: false }`).
- Descriptions are author text rendered as React text, not raw HTML, so there is no injection risk in options 2 and 3
  **[inference]**.

## 6. Open items for planning

- Content: card quality depends on descriptions. Writing `description` for the ~97 pages linked from closing sections
  would replace excerpts that stop mid-sentence or end with a colon. These values also become the pages'
  `<meta name="description">`.
- Decide which section shapes become cards (single-link list items only, or prose bullets too), and what happens to
  external links (19 of 149).
- Prototype checks: trailing-slash matching of `href` to global data `path`; a `format: md` fallback page; a closing
  section inside `<Applies>` and inside a partial.
