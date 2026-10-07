# WSO2 docs site

One documentation site for every WSO2 product, cloud and self-hosted, built with Docusaurus. Product teams keep writing in their own repositories (content sources); this site pulls pinned commits, converts them and publishes them under one navigation.

Decisions behind this design are in the planning map: `.scratch/wso2-docs-site/map.md`.

## Quick start

Requires Node 22 and git.

```sh
cd docs-site
npm ci --ignore-scripts
npm test                      # converter unit tests
npm run fetch                 # fetch pinned content sources into .cache/ (FETCH_ASSETS=0 skips images)
npm run content               # convert them into generated/
npm run build && npm run serve
```

`npm start` runs the dev server after `npm run content`.

The full build takes 15 to 30 minutes. While checking a change, build only the sections it touches (2 to 4 minutes), using product or section ids from `content-sources.yaml`:

```sh
npm run content -- integration-integrator    # reconvert just that section
npm run build:quick -- integration           # all Integration Platform sections, into site/build-quick
npm run start:quick -- identity              # dev server with only Identity Platform
```

Navigation still lists every product; links into sections left out of a quick build show as broken-link warnings. Quick and full builds share `site/.docusaurus`, so run one at a time. CI always runs the full build.

## How it works

| Piece | What it does |
|---|---|
| `content-sources.yaml` | Lock file. Every product section, its content source repo, the commit it is pinned to, the branch the bump bot tracks, default deployment options, its current site and its exclude list. Changed only through reviewed pull requests. |
| `scripts/fetch-sources.mjs` | Shallow, blob-filtered, sparse fetch of exactly the pinned commits. Validates every repo name, commit and path first; never uses a shell. |
| `converter/` | Renders the MkDocs Jinja subset (parsed with an allow-list, never evaluated as code), expands includes (`{% include %}`, `{!file!}`, `--8<--`, `{{#var#}}`) confined to the source repo, applies the HTML allow-list, rewrites MkDocs syntax to MDX, merges cloud and self-hosted pages that share templates (Identity Platform), and builds sidebars from MkDocs `nav:`. |
| `scripts/build-content.mjs` | Converts every section into `generated/`. A page on the section's exclude list becomes a redirect to the same page on the product's current site (even once it converts, since it may still fail the Docusaurus build); a failing page not on the list stops the build. `--onboard` records the first exclude list; `--prune` removes pages that now pass. Lists only shrink. |
| `site/` | Docusaurus: Oxygen UI look through Infima variables and MUI islands, Products mega-menu, product bar with section tabs and version selector, the "Deployment options" box, labelled cloud/self-hosted blocks. |
| `scripts/bump-sources.mjs` | Bump bot: moves pins to the head of each tracked branch (auto-merged PR) and proposes Latest promotions when a product publishes a newer GA release (PR needing docs-team approval). |
| `scripts/check-source.mjs`, `check-action/` | The same conversion as a CLI and a GitHub Action for content repos to run on their pull requests. |
| `.github/workflows/docs-site-*.yml` | CI build, hourly content bump, daily version promotion. Actions pinned by commit, least-privilege tokens, no credentials persisted, no tokens in content repos. |

## Content source rules (summary)

Allowed: Jinja `if/elif/else`, comparisons, `and/or/not`, `in`, `is defined`, `include`, `set`, `raw`, `{{ variable }}`; MkDocs admonitions, collapsibles, tabs, `attr_list`, fenced code. Not allowed: ternaries, filters, macros, loops; `<script>` (except the quick-start `const meta = {…}` literal), `<style>`, `<form>`, `<object>`, `<embed>`, event-handler attributes, `javascript:` URLs, iframes outside YouTube and Vimeo. Full contract: `.scratch/wso2-docs-site/issues/13-conversion-contract.md`.

## Known limits

- The converter's compile check uses MDX 3 + GFM + directives. Docusaurus adds link and image processing, so a page can pass the check and still fail the site build; CI runs the full build as the final gate.
- Search is a placeholder until the search decision (Algolia DocSearch legal review) lands.
- Agent Manager's cloud pages (a hand-forked Docusaurus version) are not combined yet. Integration Platform (Devant) and API Platform (Bijira) place their cloud trees into the self-hosted sidebar through `cloud_companion` placement maps awaiting product-team confirmation.
- Pages MkDocs builds from theme templates (section homes, catalogues) get a generated overview of links; `redoc` API reference pages are not rendered yet.
- `npm audit` reports advisories in Docusaurus 3.10.2's build-time dependencies. The published site is static; mitigate with `overrides` and isolated CI builds after security review.
