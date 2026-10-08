# @wso2/docs-converter

Converts WSO2 documentation sources into Docusaurus MDX for the WSO2 docs site:

- **MkDocs sites**: renders the Jinja subset WSO2 docs use (`{{ var }}`, `{% if %}`, `{% include %}`, `{% set %}`, `{% raw %}`) with an allow-listed grammar that never runs code, expands `{!file!}` and `--8<--` includes (never outside the repository), applies the HTML allow-list, rewrites MkDocs Material syntax (admonitions, tabs, collapsibles, `attr_list`) and builds the sidebar from `nav:`.
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
| `--format text\|github\|json` | `text` | `github` prints workflow annotations on the failing file and line |

Exit codes: `0` every page converts or is on the exclude list, `1` new failures, `2` usage or config error.

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

The docs site uses the same functions, passing a `fallback` that writes a redirect page for excluded or failing pages; the CLI writes none.

## Development

```sh
npm install
npm test        # tsc (strict) + node:test
```

Security notes: conditions and quick-start metadata are parsed, never executed; includes cannot leave the repository; scripts, styles and event handlers are removed or rejected. Evaluating a Docusaurus `sidebars.ts/.js` runs that file's code, as Docusaurus itself would: only run it on reviewed, pinned sources.
