# WSO2 docs site

One documentation site for every WSO2 product, cloud and self-hosted, built with Docusaurus. Product teams keep writing in their own repositories (content sources); this site pulls pinned commits, converts them and publishes them under one navigation.

Decisions behind this design are in the planning map: `.scratch/wso2-docs-site/map.md`.

## Quick start

Requires Node 22 and git.

```sh
cd docs-site
npm ci --ignore-scripts
npm test                      # converter package: strict type check + unit tests
npm run fetch                 # fetch pinned content sources into .cache/ (FETCH_ASSETS=0 skips images)
npm run content               # convert them into generated/
npm run build && npm run serve
```

`npm start` runs the dev server after `npm run content`.

The full build takes 15 to 50 minutes depending on free memory. While checking a change, build only the sections it touches (about 10 minutes for Integration Platform, the largest product; less for smaller ones), using product or section ids from `content-sources.yaml`. For one page, `start:quick` is fastest: the dev server compiles pages as you open them.

```sh
npm run content -- integration-integrator    # reconvert just that section
npm run build:quick -- integration           # all Integration Platform sections, into site/build-quick
npm run start:quick -- identity              # dev server with only Identity Platform
```

Navigation still lists every product; links into sections left out of a quick build show as broken-link warnings. Quick and full builds share `site/.docusaurus`, so run one at a time. CI always runs the full build.

## How it works

| Piece | What it does |
|---|---|
| `content-sources.yaml` | Lock file. Every product section, its content source repo, the commit it is pinned to, the branch the bump bot tracks, default deployment options, its current site and its exclude list. A section may list `versions:` (see Versions below) and the top-level `live_window`. Changed only through reviewed pull requests. |
| `scripts/fetch-sources.mjs` | Shallow, blob-filtered, sparse fetch of exactly the pinned commits. Validates every repo name, commit and path first; never uses a shell. |
| `packages/docs-converter/` | **`@wso2/docs-converter`**, the TypeScript package (npm workspace) that does all conversion: renders the MkDocs Jinja subset (parsed with an allow-list, never evaluated as code), expands includes (`{% include %}`, `{!file!}`, `--8<--`, `{{#var#}}`) confined to the source repo, applies the HTML allow-list, rewrites MkDocs syntax to MDX, merges cloud and self-hosted pages that share templates (Identity Platform), prepares Docusaurus sources and builds sidebars. Ships the `wso2-docs` CLI. See its README. |
| `scripts/build-content.mjs` | Converts every section into `generated/` using `@wso2/docs-converter`. A page on the section's exclude list becomes a redirect to the same page on the product's current site (even once it converts, since it may still fail the Docusaurus build); a failing page not on the list stops the build. `--onboard` records the first exclude list; `--prune` removes pages that now pass. Lists only shrink. |
| `site/` | Docusaurus: Oxygen UI look through Infima variables and MUI islands, Products mega-menu, product bar with section tabs and version selector, the "Deployment options" box, labelled cloud/self-hosted blocks. |
| `scripts/bump-sources.mjs` | Bump bot: moves Latest to the head of its tracked branch and listed versions to docs fix releases (auto-merged PR), and proposes Latest promotions when a docs release matches a product GA release (PR needing docs-team approval). See `CONTENT-RELEASES.md`. |
| `scripts/snapshots.mjs` | Builds, stores and assembles frozen versions (snapshots): `list`, `build`, `assemble`. |
| `scripts/check-links.mjs` | Checks internal links in a built site, including the merged live and snapshot output. |
| `wso2-docs` CLI, `check-action/` | The same conversion for content repos: `wso2-docs check` on pull requests (the Action annotates failing lines), `wso2-docs convert` to produce a converted artifact. |
| `.github/workflows/docs-site-*.yml` | CI build and merged link check, snapshot builds, hourly content bump, daily version promotion. Actions pinned by commit, least-privilege tokens, no credentials persisted, no tokens in content repos. |

## Versions

A section lists its releases under `versions:`, newest first (merged sections put it under `self_hosted:`). Each entry has `version` (three segments), `ref` (branch or tag), `sha` (40 characters) and optionally `mkdocs`, `docs`, `sidebar`, `sparse` and `exclude`. Only the first entry (Latest) may carry `track: true`; older versions stay pinned. `release_tag` sets the docs-release tag prefix (default `v`, or `<component>/v`). `older_versions` lists versions with no source in git as "Older versions" links to their former documentation (Confluence spaces, or a former docs site such as ei.docs.wso2.com): each entry has `version`, `href` (https) and an optional `label` shown in the selector instead of the version (plain text, at most 80 characters, for example `Enterprise Integrator 7.1.0`).

Components kept as version folders inside one MkDocs site (API Platform: `en/docs/api-gateway/1.2.0/` and so on, all on `main`) are sections with `docs_root: <component>/{version}/` and `nav_root: <component's nav entry>`: the folder is the section root, the nav is that release's entry, and `former_site` with `{version}` is the folder's URL on the former site. A relative link that leaves the folder goes to the section hosting its target: another component's folder to that version's route (Latest without a version segment, a version not in the lock to the section root), other pages to the section or cloud companion whose `only`/`skip` takes them, `next/` folders stay as written (unpublished). Files outside the folder that pages use are copied into the section's `_shared/` folder. `former_route` makes every Latest page also answer at its old URL with a redirect (the components used to live under `api-platform/platform/<component>/<version>/`). Such cross-section links read the version lists, `docs_root` and routes of the component sections sharing the source and the `only`/`skip`/`path_prefix` of the sections and companions hosting its other pages; a snapshot key covers exactly those fields, so a component release rebuilds the snapshots that link to it. A page path that would write a redirect outside `<former_route>` (a hostile front-matter slug) is skipped with a warning.

`live_window` (top level, now `1`) is how many versions per section the live build contains. Older versions are snapshots, built once and stored by key. It was 2 (Latest and the previous release) until the pilot showed a full live build at that window exceeds the 14 GB threshold; see the pilot measurements.

```sh
npm run snapshots -- list [--json] [--missing]         # snapshot ids and keys; --missing: only keys not stored yet
npm run snapshots -- build <versionId> [--record-baseline]   # fetch, convert, build, gate and store one snapshot
npm run snapshots -- assemble <live-build> <out> [--allow-missing]   # merge stored snapshots (out may equal live-build)
npm run check-links -- <build-dir> [--baselines link-baselines]      # internal link check; with baselines, only new breakage fails
npm run preview -- [site/build-merged]                 # local static server (docusaurus serve 404s dotted paths like /identity/7.1.0/)
```

A snapshot key hashes the version's whole lock entry (source commit, paths, exclude list and the section settings it inherits), the converter (`packages/docs-converter/src` and its `tsconfig.json`), the site chrome (`site/src`, `site/plugins`, `site/docusaurus.config.js`, the account section `site/account/` and `site/account-sidebars.js`, `site/static/`, the build scripts including `scripts/fetch-sources.mjs`, and `package-lock.json`), the navigation catalogue (groups, product names and blurbs, section labels and routes) and the Node.js major version, so a theme change rebuilds every snapshot; for a version folder of a shared MkDocs source (`docs_root`) it also covers the lock fields its links into the sharing sections read. A snapshot's output depends on nothing else: its pages map links only to their own version's former site (and, for `docs_root` sections, to the sharing sections' routes), and its Products menu and product bar link to each section's root (`/<route>/`), which the live build always serves (a redirect to the landing page when a section has no index page). `build` checks the store first, then fetches the version's sources itself, and fails when broken internal links exceed the committed baseline `link-baselines/<versionId>.json`. A re-pin that introduces new source breakage needs `build <versionId> --record-baseline` in a reviewed PR.

Links to a version's former site become links to the page here when this site hosts it. That covers full URLs and, for sites with `/en/<version>/` paths, root-relative paths (`/en/4.6.0/...`) written for the former host: a hosted page or file (images and downloads, copied into the version's static folder) becomes internal, anything else goes to the former site as a full URL.

`npm run content` and `fetch-sources.mjs` skip snapshot versions unless they are named by version id (`build` does that).

The PR check assembles the snapshots whose key is stored and reports the others as pending (a warning, not a failure): a PR that changes a key (a docs fix release, a promotion, a converter or theme change) can merge, and the snapshot workflow builds the new keys after merge. A deploy must assemble without `--allow-missing`, so it waits until every key is stored. The check fails on a Latest build error and on broken links that no committed baseline lists: the per-version files and `link-baselines/live.json` (live pages and links from snapshots into other sections). Re-record `live.json` with `node scripts/check-links.mjs site/build-merged --baselines link-baselines --record-live` in a reviewed PR when breakage is accepted. The same check counts literal Markdown link and image syntax (`![`, `](`) left in rendered paragraph text, a link or image that failed to parse and that the link check cannot see; a page fails when its count exceeds the one in `link-baselines/literal-markdown.json` (source content that is not valid Markdown), and `--record-live` re-records that file too.

The live build needs a 12 GB heap (`DOCS_HEAP_MB`, default 12288; 8 GB fails at `live_window: 1`) and about 11 GB of disk for the merged output. The CI runner must have at least 16 GB of RAM: `ubuntu-latest` does on public repositories, but has 7 GB on private ones, which need a larger runner.

`SNAPSHOT_STORE` chooses where snapshots live. Unset, it is the local directory `.cache/snapshots`. In CI it is `github-release:docs-site-snapshots` (a GitHub Release holding one tarball per key); that backend needs a GitHub remote and `GH_TOKEN`, and only the snapshot upload job has write access. The workflow builds with read-only permissions and no token, hands the tarball over as a workflow artifact, and a separate upload job (no checkout, no `npm ci`, no repository scripts) checks its name and uploads it.

## Content source rules (summary)

Allowed: Jinja `if/elif/else`, comparisons, `and/or/not`, `in`, `is defined`, `include`, `set`, `raw`, `{{ variable }}`; MkDocs admonitions, collapsibles, tabs, `attr_list`, fenced code. Not allowed: ternaries, filters, macros, loops; `<script>` (except the quick-start `const meta = {…}` literal), `<style>`, `<form>`, `<object>`, `<embed>`, event-handler attributes, `javascript:` URLs, iframes outside YouTube and Vimeo. Full contract: `.scratch/wso2-docs-site/issues/13-conversion-contract.md`.

## Known limits

- The converter's compile check uses MDX 3 + GFM + directives. Docusaurus adds link and image processing, so a page can pass the check and still fail the site build; CI runs the full build as the final gate.
- Search is a placeholder until the search decision (Algolia DocSearch legal review) lands.
- Agent Manager's cloud pages (a hand-forked Docusaurus version) are not combined yet. Integration Platform (Devant) and API Platform (Bijira) place their cloud trees into the self-hosted sidebar through `cloud_companion` placement maps awaiting product-team confirmation.
- Pages MkDocs builds from theme templates (section homes, catalogues) get a generated overview of links; `redoc` API reference pages are not rendered yet.
- `npm audit` reports advisories in Docusaurus 3.10.2's build-time dependencies. The published site is static; mitigate with `overrides` and isolated CI builds after security review.
