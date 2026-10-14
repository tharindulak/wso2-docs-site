# @wso2/docs-converter

Converts WSO2 documentation sources into Docusaurus MDX for the WSO2 docs site:

- **MkDocs sites**: renders the Jinja subset WSO2 docs use (`{{ var }}`, `{% if %}`, `{% include %}`, `{% set %}`, `{% raw %}`) with an allow-listed grammar that never runs code, expands `{!file!}` and `--8<--` includes (never outside the repository), applies the HTML allow-list, rewrites MkDocs Material syntax (admonitions, tabs, collapsibles, `attr_list`) and builds the sidebar from `nav:`. Pages keep MkDocs URLs and titles: a `README.md` with no `index.md` beside it is its folder's index, a page with no `title` and no H1 takes its nav label or a title from its file name (folder name for an index page), and `{{ base_path }}/en/<version>/` with a host-only `base_path` becomes the full former-site URL.
- **Cloud + self-hosted pairs** that share templates (for example `docs-is`): merges them into one page per topic; differences become labelled `<Applies>` blocks, differing values `<DeploymentValue>`, differing code samples one labelled copy per option.
- **Docusaurus docs folders**: adds deployment options and edit links, fixes image paths and `.mdx` links, swaps source-only components for stand-ins, and evaluates the sidebars file.

Written in TypeScript; published as compiled JavaScript with type definitions. Node 20 or later.

## CLI

```sh
npx wso2-docs check                 # convert every page in memory; report pages that would not reach the site
npx wso2-docs convert --out dist    # write dist/docs/, dist/sidebar.json, dist/manifest.json
```

| Option | Default | |
|---|---|---|
| `--config <file>` | `wso2-docs.yaml` | Converter config in the repository |
| `--root <dir>` | `.` | Repository root; includes and paths never resolve outside it |
| `--out <dir>` | `dist` | `convert` only; must be inside the repository and either new or written by `wso2-docs` before |
| `--release-tag <tag>` | | `check` only. A docs release tag (`v7.4.0`, `api-gateway/v1.3.0`, `v4.8.0.1`); warns when its version has no folder. Needs `--version-folder` |
| `--version-folder <pattern>` | | `check` only. Folder pattern with `{version}`, for example `en/identity-server/{version}`, relative to `--root` |
| `--format text\|github\|json` | `text` | `github` prints workflow annotations on the failing file and line |

The release check is a warning on stderr (`warning: release v7.4.0 has no folder en/identity-server/7.4.0`) and never changes the exit code. Release conventions: `docs-site/CONTENT-RELEASES.md`.

Exit codes: `0` every page converts or is on the exclude list, `1` new failures or bad lifecycle stage values, `2` usage or config error. Front matter that is not valid YAML is reported as a warning (the page converts without it, as before).

Lifecycle stage front matter: `status: beta | preview | deprecated` (none: generally available); with `deprecated`, `deprecated_since` (required, quoted: `"7.3.0"` or `"2026-09"`), `replacement` (optional: a relative `.md` page link, which must name a page, an `http(s)` URL or a site path) and `removal` (optional, once approved). Bad values are reported and left out. On a merged cloud + self-hosted page each copy keeps its own stage: the fields stay flat when both copies carry the same ones, else they go per deployment option under `lifecycle:` (`lifecycle: { WSO2 Cloud: { status: deprecated, deprecated_since: "2026-03" } }`; an option missing there is generally available). Where the page's badge shows Deprecated, "(deprecated)" is removed from its title, first heading and sidebar label.

### `wso2-docs.yaml`

Same field names as a section of the docs site's `content-sources.yaml`, without the repository and commit.

```yaml
kind: mkdocs                       # mkdocs | mkdocs-merge | docusaurus
route: integration/micro-integrator # route on the docs site (absolute links); default "docs"
deployment_options: [Self-hosted]
deployment_overrides:              # optional: path prefix -> options, longest prefix wins
  deploy/cloud/: [WSO2 Cloud]
mkdocs: en/mkdocs.yml              # kind: mkdocs
current_site: https://mi.docs.wso2.com/en/latest/
edit_url: https://github.com/wso2/docs-mi/blob/main/   # optional: "Edit this page" prefix
exclude: exclude.txt               # optional: known failing pages (list, or a file, one path per line); may only shrink
```

For `kind: mkdocs-merge`, give `cloud: { mkdocs, current_site }`, `self_hosted: { mkdocs, current_site }` and `shared_names` (for example `product_name: WSO2 Identity Platform`). For `kind: docusaurus`, give `docs`, `sidebar` and optionally `shims`.

### Output (`convert`)

```
dist/
├── docs/          converted pages (.md, MDX or CommonMark fallback) and their images
├── sidebar.json   { "<sidebarId>": [ ...Docusaurus sidebar items ] }
└── manifest.json  contract version, converter version, source commit, converted and failed pages
```

`manifest.json` → `contract` is the output layout version (currently `1`). The docs site rejects contract versions it does not support.

## Library

```ts
import { convertMkdocsSite, convertMergedSites, prepareDocusaurusDocs, convertSource, convertRendered } from '@wso2/docs-converter';

const { sidebar, report } = await convertMkdocsSite(
  { root: '.', mkdocs: 'en/mkdocs.yml', deployment_options: ['Self-hosted'] },
  { outDir: 'dist/docs', route: 'integration/micro-integrator' },
);
```

`@wso2/docs-converter/rehype-valid-elements` exports just the rehype plugin for CommonMark pages, without loading the converter (the docs site's Docusaurus config uses it).
`@wso2/docs-converter/remark-steps` does the same for the remark plugin that renders runs of `Step N` headings as a stepper; a page opts out with `stepper: false` in front matter.
`@wso2/docs-converter/remark-linked-tabs` is the remark plugin for linked tabs: `<Tabs>` blocks offering the same choices (labels compared ignoring case, spaces, Markdown formatting and order; Linux and macOS/Linux forms are one choice) switch together, and the choice is remembered. Blocks with an author-set `groupId`, value or `defaultValue`, a single tab, or two labels naming one choice are left as written.
`@wso2/docs-converter/remark-prerequisites` renders prerequisites blocks as a panel where they are written: an `h2`/`h3` titled "Prerequisites" or "Before you begin" (up to the next heading at its level or above, or a stepper; run it after `remark-steps`), or an admonition of any type with that title; a page opts out with `prerequisites: false` in front matter.
`@wso2/docs-converter/lifecycle` holds the lifecycle stage rules without Node imports: the docs site reads which badge a page shows (`lifecycleBadge`: Preview wins, then Deprecated, then Beta; the scope lists the options it covers when not all) in its config and in the browser.
`@wso2/docs-converter/remark-link-cards` renders closing sections as cards: an `h2`/`h3` titled "What's next", "Next steps", "See also", "Learn more", "Related topics", "Related links" or "Further reading" whose content (up to the next heading at its level or above) is exactly one list of items that each start with a link and hold no nested list. The list is wrapped in `<LinkCards items>` (link, link text and the author's text after it) and kept as the fallback; the site's `LinkCards` component adds the linked doc's description, or an external link's host, when the author wrote none. Other closing sections stay as written; a page opts out with `link_cards: false` in front matter.

The docs site uses the same functions, passing a `fallback` that writes a redirect page for excluded or failing pages; the CLI writes none.

## Development

```sh
npm install
npm test        # tsc (strict) + node:test
```

Security notes: conditions and quick-start metadata are parsed, never executed; includes cannot leave the repository; scripts, styles and event handlers are removed or rejected. Evaluating a Docusaurus `sidebars.ts/.js` runs that file's code, as Docusaurus itself would: only run it on reviewed, pinned sources.
