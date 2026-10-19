# 07 How reference docs sites implement content components (researched 2026-10-12)

Answers [issue 07](../issues/07-content-components-research.md).

Scope: **content components** only (see [CONTEXT.md](../../../CONTEXT.md)). It goes deeper on [research 17](../../wso2-docs-site/research/17-documentation-elements.md) section B and does not repeat its inventory. Base syntax already in the [conversion contract](../../wso2-docs-site/issues/13-conversion-contract.md) (tabs, includes, variables, conditionals, admonitions) is covered only where an extension is in question.

**Method.** Read on 2026-10-12:
- open-source repos: `github/docs` at be38ec5, `cloudflare/cloudflare-docs` at 4e761ed, `gitlab-org/technical-writing/docs-gitlab-com` at 5dec2ec, `hashicorp/dev-portal` at aaf0891, plus `gitlab-org/gitlab` (`doc/development/documentation/`, `doc/.vale/`, `data/deprecations/`), `hashicorp/web-unified-docs` (`docs/`, read only), `MicrosoftDocs/Contribute`, `MicrosoftDocs/azure-docs`, `dotnet/docfx`, `squidfunk/mkdocs-material`
- live HTML: Stripe pages embed their Markdoc render tree as JSON, so tag names and attributes are visible (6 pages sampled); Microsoft Learn page metadata
- our own converter (`docs-site/packages/docs-converter/src/syntax.ts`) and the `mkdocs.yml` files of the fetched content sources

Stripe and the Microsoft Learn platform are closed source; their rows describe authoring docs or rendered output only. **[unverified]** marks a claim not confirmed in a primary source. All of this is planning input for review by the docs team. Nothing here is decided.

Site abbreviations: GL = GitLab, GH = GitHub, HC = HashiCorp, MS = Microsoft Learn, ST = Stripe, CF = Cloudflare. "WSO2 option" rows are suggestions for the map, written as MkDocs (Material for MkDocs / pymdown) source plus the Docusaurus rendering the converter would produce.

## TL;DR

- **Most "components" are conventions, not code.** Prerequisites, closing sections, deprecation notices and topic types are plain headings or alerts plus a style guide on five of six sites. Enforcement, where it exists, is a linter: GitLab's Vale rules (`Prerequisites.yml`, `HistoryItems.yml`, `Badges-Tiers.yml`) and GitHub's markdownlint rules (`GHD038 expired-content`, `GHD046 outdated-release-phase-terminology`). Only GitHub turns one into structured data (`permissions:` front matter rendered as a box).
- **Synced tabs is the one with a live WSO2 gap.** Six content sources already enable Material's `content.tabs.link`, which syncs tabs by label site-wide and persists the choice. Our converter emits `<TabItem value="tab-0">` (positional), so it silently drops that behaviour, and adding `groupId` alone would sync by position, not label. Cloudflare (`syncKey`), HashiCorp (`group`), GitHub (cookie plus `?tool=`), Stripe (`pref`) and Microsoft (`#tab/id`) all sync by a stable id.
- **Steps:** Cloudflare `<Steps>` is pure CSS counters over an ordered list. GitLab `guide` is a Hugo shortcode for tutorials only; it falls back to a plain ordered list in product help. Stripe's steps are richer (`StepSection` number and title, `Step` with `when` conditions). GitHub, Microsoft and HashiCorp use plain lists.
- **Lifecycle and history are GitLab's speciality.** GitLab has `details` (Tier, Offering, Status: Beta / Experiment / Limited availability, GA has none) and `history`, which renders as a collapsible. Both are Vale-checked, and a central deprecations page is generated from `data/deprecations/*.yml`. Elsewhere lifecycle is a badge or an alert:
  - Cloudflare: sidebar `badge` front matter. Its style guide says avoid inline badges.
  - Stripe: a `Callout type="public-preview"`.
  - Microsoft: a per-product preview include inside `> [!IMPORTANT]`.
- **Alerts:** GitHub and Microsoft use the same five GFM alert types. GitLab has only four (`note`, `flag`, `warning`, `disclaimer`), with tip, caution and important aliased. HashiCorp still converts `->`, `~>`, `!>`, `=>` paragraphs at build time. Stripe adds `public-preview` and `regional` (with `countries`).
- **Code extras worth copying:**
  - Code annotations: Material has these natively (`# (1)!`). GitHub has `annotate`, which needs `layout: inline`.
  - Editable placeholders: GitLab `{editable="true"}` makes `<PLACEHOLDER>` an inline field, kept in sessionStorage.
  - Stripe `CodeTooltip`.
  - Cloudflare `WranglerConfig`: one TOML or JSONC block in, both formats out. It fails the build on bad input, but uses `@iarna/toml`, unpublished since 2020.
- **Research 17 needs these corrections:**
  - Cloudflare's `pcx_content_type` is optional, not required.
  - GitLab's `guide` exists (no longer unverified) but is for tutorials only.
  - The alert set differs by site.
  - Microsoft's description length is 75-300 characters in its rules table.
  - The tabs gap is position versus label, not only a missing `groupId`.

## Licences of the implementations read

| Repo / package | Licence | Note |
|---|---|---|
| github/docs | MIT code, CC BY 4.0 content | Liquid tags, linter rules, React pickers |
| gitlab-org/technical-writing/docs-gitlab-com | MIT | Hugo shortcodes and render hooks |
| gitlab-org/gitlab `doc/` | CC BY-SA 4.0 for docs [unverified for `doc/.vale`] | Share-alike: describe Vale rules, do not copy prose |
| cloudflare/cloudflare-docs | MIT code, CC BY 4.0 content | Astro components |
| @cloudflare/nimbus-docs 0.15.0 | MIT | Theme behind Steps, Tabs, Badge, FileTree, PackageManagers |
| @iarna/toml 2.2.5 | ISC | Used by `WranglerConfig`; last published 2020-04-22. Supply-chain flag: unmaintained |
| hashicorp/dev-portal | MPL-2.0 | File-level copyleft; needs OSS review before reusing a file |
| hashicorp/web-unified-docs | BUSL-1.1 | Not open source. Read only, no reuse without legal review |
| MicrosoftDocs/Contribute, MicrosoftDocs/azure-docs | CC BY 4.0 content (azure-docs code MIT) | Authoring guides only; the Learn platform is closed |
| dotnet/docfx | MIT | Public spec of the `#tab/` syntax Learn uses |
| Stripe docs | Closed | Markdoc itself is MIT |
| squidfunk/mkdocs-material | MIT | Source of the MkDocs equivalents |
| mkdocs-glightbox | MIT [unverified, PyPI licence field empty] | Lightbox plugin used by 5 content sources |

WSO2 code is Apache-2.0. MIT, ISC and BSD code is compatible with attribution. The MPL-2.0 and BUSL-1.1 entries need OSS or legal review before any reuse, so treat those repos as reading only. Build our own components on Docusaurus (MIT) primitives.

## 1. Steps

| Site | Authoring syntax | Rendering | Validation | Degradation |
|---|---|---|---|---|
| CF | `<Steps>` wrapping a Markdown `1.` list (MDX import) | CSS `counter-reset` and `::before` circles and a connecting line over `ol > li`; `start` prop offsets numbering | None beyond MDX compile | Without the wrapper it is a normal ordered list |
| GL | `{{< guide >}}` around `1.` items; title is the first line, indented lines are the body | `<ol class="guide">` with bold item titles and indented content | Build `errorf` on a nested alert or tab shortcode inside a guide; style guide: "Use guides for tutorials only" | Renders as a plain ordered list in GitLab product help |
| ST | Markdoc `StepSection` (`number`, `title`, `toggle`) and `Step` (`id`, `when: {server: "node"}`) | Numbered sections; steps filtered by the reader's language or platform choice; a `File` tag lists which step ids touch which lines | Closed [unverified] | n/a |
| GH, MS, HC | Plain `1.` lists. MS renders nested numbers as letters; CF and MS forbid letter lists | Normal list | GL and HC style rules only | n/a |
| **WSO2 option** | Keep `## Step N:` headings (about 1,120 pages, [issue 09](../issues/09-automatic-stepper.md)); optionally `<div class="steps" markdown>` around a list (`md_in_html`) for list procedures | Converter wraps the run in a `Steps` MDX component using CF's CSS-counter approach; no client JS | `wso2-docs check` can warn on gaps in `Step N` numbering | Unwrapped headings or lists still read correctly in MkDocs preview |

## 2. Lifecycle badges (Beta, Preview, GA, Deprecated)

| Site | Authoring syntax | Rendering | Validation | Degradation |
|---|---|---|---|---|
| GL | `- Status: Beta` (or `Experiment`, `Limited availability`) inside `{{< details >}}` under the title or a heading; GA has no status | Availability box under the heading: bold key, value | Vale `Badges-Tiers.yml`, `Badges-Offerings.yml` (error level) check tier and offering wording; status values by style guide only | Box is plain `- Key: value` bullets if the shortcode is missing |
| CF | Page: `sidebar: badge: {text: Beta}` front matter. Inline: `<InlineBadge preset="beta" />` (presets alpha, beta, deprecated, early-access, legacy) | Sidebar pill; inline pill | Zod schema on front matter | Style guide says **avoid inline badges** ("may hurt readability"); write "(beta)" as text instead |
| ST | `Callout type="public-preview"`; `Badge release="public-preview"` | Callout or pill | Closed | n/a |
| MS | `[!INCLUDE [x-preview](../includes/x-preview.md)]`, a per-product include holding `> [!IMPORTANT]` and the preview terms link | Important alert | None found | n/a |
| GH | Words only ("public preview"), often from a reusable | Text | Linter `GHD046` (error): "beta" to "public preview", "alpha" to "private preview", "deprecation" to "closing down" | n/a |
| HC | `<EnterpriseAlert product="vault" />` (edition, not lifecycle); Vault `<Tag>` | Alert with product badge | None found | n/a |
| **WSO2 option** | Page: Material `status: new` or `status: deprecated` front matter (custom ids via `extra.status`; needs Material 9.2, but some sources pin 9.1.2). Section: a custom admonition such as `!!! preview` or a `details` block (section 4) | Sidebar badge from front matter; section pill or alert | Converter allow-lists status ids; check rejects unknown ones | MkDocs 9.1 ignores `status`; an unknown admonition type renders as a plain note |

## 3. Feature history

| Site | Authoring syntax | Rendering | Validation | Degradation |
|---|---|---|---|---|
| GL | `{{< history >}}` with `- [Introduced](link) in GitLab 16.3.` bullets; fixed verbs (Introduced, Changed, Moved, Generally available), feature-flag entries, removal of unsupported versions | Collapsible titled "History" (same partial as `collapsible`) | Vale `HistoryItems.yml` (error: must be a shortcode with `-` bullets), `HistoryItemsOrder.yml` (error: after `details`), `OutdatedVersions.yml` (suggestion) | Plain bullet list |
| GH, HC, MS, CF, ST | No inline history found. Versioned docs (`ifversion`, version selector) and changelogs carry it instead | n/a | n/a | n/a |
| **WSO2 option** | `??? info "History"` collapsible (pymdownx.details, already in the contract) with fixed-wording bullets, or `<!-- md:version 7.1.0 -->` comments as Material's own docs do (rendered by its `shortcodes.py` hook, MIT) | Docusaurus `<details>` with a "History" summary | A check rule on wording ("Introduced in Identity Server 7.1") | `???` renders as a collapsible in MkDocs today; HTML comments are invisible if not converted |

## 4. Prerequisites and required roles

| Site | Authoring syntax | Rendering | Validation | Degradation |
|---|---|---|---|---|
| GH | `permissions:` and `product:` front matter (strings, Markdown allowed); per-procedure permission sentences in body | `PermissionsStatement` box in the intro with person and briefcase icons | AJV front matter schema (type only); content model says "Every procedure includes a permissions statement" | Box not shown when both fields are empty |
| GL | `Prerequisites:` line plus bullets assuming "You must have:"; roles listed first; never subscriptions | Plain text | Vale `Prerequisites.yml` (warning) on singular "Prerequisite:" | n/a |
| MS | `## Prerequisites` heading in quickstarts (seen on Azure Blob quickstart) | Normal H2 in the right-rail TOC | Template-driven [unverified that build enforces it] | n/a |
| CF | "Before you begin, make sure that you have:" plus a bulleted list, before the first step | Plain | Style guide only | n/a |
| HC | `## Requirements` block in the usage template (system, environment, versions) | Plain | Template only | n/a |
| ST | None seen | n/a | n/a | n/a |
| **WSO2 option** | `## Prerequisites` heading by template; optional front matter `permissions:` (role strings) rendered as a box like GitHub's | Box above the first heading | Check warns when the field is not a string list | Front matter is ignored by MkDocs; heading reads normally |

## 5. Closing sections (Next steps, Related topics, Clean up)

| Site | Authoring syntax | Rendering | Validation | Degradation |
|---|---|---|---|---|
| GH | `## Next steps` (prose or list) and `## Further reading` (bullets, links not used in body) | Plain H2s | Content model only | n/a |
| MS | `## Clean up resources`, `## Next steps`; `> [!div class="nextstepaction"]` with a link | Plain H2s; next step link as a button | `[!div]` class allow-list [unverified] | Without the extension the blockquote shows as a quote |
| GL | `## Related topics` bullet list, above Troubleshooting | Plain | Style guide | n/a |
| CF | One or two sentences of next steps, cross-links by content type | Plain | Style guide | n/a |
| HC | `## Next steps` in templates; `> **Hands-on:** Try the ... tutorial` | Plain; blockquote | Template | n/a |
| ST | Markdoc `SeeAlso` tag (`title="Next steps"`, `level`) | Card list | Closed | n/a |
| **WSO2 option** | Template headings only (`## Next steps`, `## Related topics`, `## Clean up`), no new syntax | Plain H2 | A soft check on fixed heading names | Nothing to degrade |

## 6. Deprecation and removal notices

| Site | Authoring syntax | Rendering | Validation | Degradation |
|---|---|---|---|---|
| GL | Title gets `(deprecated)`; `> [!warning]` with deprecated-in, removal version and replacement; content wrapped in `<!--- start_remove ... remove_date: 'YYYY-MM-DD' -->` / `<!--- end_remove -->`; removed pages keep title plus `remove_date` and `redirect_to` front matter. Central page from `data/deprecations/*.yml` (`removal_milestone`, `breaking_change`, `impact`, `scope`...) | Warning alert; generated "Deprecations and removals by version" page | Template fields; removal dates drive cleanup | Comments invisible |
| GH | `<!-- expires 2026-12-01 -->` ... `<!-- end expires 2026-12-01 -->` around time-bound text | Invisible | Linter `GHD038` fails once the date passes | Text stays until removed |
| CF | `<InlineBadge preset="deprecated" />` or `legacy`; `noindex: true` for "historically accurate, but no longer recommended" pages | Pill; page out of search | Zod | n/a |
| MS, HC, ST | Warning or important alerts by convention [unverified for a template] | Alert | n/a | n/a |
| **WSO2 option** | `status: deprecated` front matter plus `!!! warning "Deprecated in 7.2"` with replacement; optional `<!-- expires YYYY-MM-DD -->` markers | Sidebar badge plus warning admonition | Check fails on an expired marker (GitHub model) | All render in MkDocs today |

## 7. Synced tabs and tool switchers

| Site | Authoring syntax | Rendering | Persistence | Validation |
|---|---|---|---|---|
| GH | Tool: `{% vscode %}...{% endvscode %}` (keys in `src/tools/lib/all-tools.ts`), `defaultTool:` front matter. OS: `{% mac %}`, `defaultPlatform:`. Code language: `{% codetabs %}{% codetab python "Python" %}` | One picker at the top of the article hides other tools' content | Cookie per picker; `?tool=` in links; OS default from user agent; preference sent as an analytics event | `defaultTool` enum from `allTools`; codetab syntax errors fail render; max eight tools by guidance |
| CF | `<Tabs syncKey="dashPlusAPI">` + `<TabItem label>`; known keys `dashPlusAPI`, `workersExamples`, `wranglerConfig` | Tabs | Nimbus `initTabs` `sync.key = ui-synced-tabs__<key>` (storage mechanism [unverified]) | None |
| HC | `<Tabs>` with `<Tab heading="..." group="terraform">` | Tabs | React context on the page only, not stored | None |
| MS | `# [Linux](#tab/linux)` ... `---`; dependent tabs `#tab/dotnet/linux`. Page level: `zone_pivot_groups:` front matter and `::: zone pivot="..."` ... `::: zone-end` | Tabs sync by id across the page; zone pivots switch the whole page | Pivot via URL [unverified] | Group ids defined per docset |
| ST | `TabGroup pref="client"`, `CodeTabGroup pref="lang"`; `Step when` | Tabs and steps follow the preference | [unverified] | Closed |
| GL | `{{< tabs >}}{{< tab title="..." >}}` | Vue tabs; `sync-active-tab-with-query-params` | URL query only | Build fails if a heading is inside tabs; `tab` requires `title`; Vale `TabsLinks.yml` |
| **WSO2 option** | No new syntax: Material `=== "Console"` tabs already in sources; 6 sources (apim, bi, devant, mi, security, si) enable `content.tabs.link` | Converter derives `value` from the label slug (not `tab-N`) and sets `groupId` from a small allow-list of label sets (Console / CLI / API; OS; deployment.toml / Helm) | Docusaurus `groupId` stores in localStorage; `queryString` adds `?tab=` links | Check warns on label sets outside the list |

## 8. Extended alert types

| Site | Authoring syntax | Types | Validation |
|---|---|---|---|
| GH | `> [!NOTE]` | Note, Tip, Important, Warning, Caution | Style guide: no consecutive alerts, one per section |
| MS | `> [!NOTE]` | Note, Tip, Important, Caution, Warning | "Limit them to one or two per article" |
| GL | `> [!note]` (shortcode form is a Vale error, `AlertFormat.yml`) | note, flag (feature-flag availability), warning, disclaimer (fixed forward-looking text, body ignored). tip to note, caution and important to warning | Shortcode `validate-shortcode` allow-list |
| HC | `-> **Note:**`, `~>`, `!>`, `=>` paragraphs (build-time `paragraph-custom-alert` transform) and `<Note>`, `<Tip>`, `<Warning>`, `<Highlight>` | info, warning, danger, success | Transform maps the symbol only |
| CF | `:::note[Title]`, `:::caution`, `:::tip`, `:::danger` | note, tip, caution, danger | MDX compile |
| ST | Markdoc `Callout type=` | note, caution, public-preview, regional (`countries: ["IN"]`) | Closed |
| **WSO2 option** | Material `!!! flag` / `!!! preview` with `extra_css` for the source preview | Add types via Docusaurus `admonitions.keywords`; converter maps them instead of folding into `note` (today 28 Material types map onto 5) | Unknown types already fall back to `note` |

Note: a `disclaimer` type with fixed text (GitLab) needs legal-approved wording before WSO2 adopts it.

## 9. Image conventions

| Site | Authoring syntax | Rendering | Validation |
|---|---|---|---|
| GL | Plain `![alt](img/name_v18_3.png)`, images in a sibling `img/` | Render hook adds width and height, lazy loading, link that opens the image in a new tab | Build **errors on external images**; Vale `ImagesOld.yml` flags `_vNN` older than supported; rules: PNG, at most 1000 x 500 px, at most 100 KB, version in file name |
| GH | Plain Markdown | Procedural images wrapped (`wrap-procedural-images`) | Linter: alt-text length, alt-text end punctuation, banned alt-text openings, kebab-case file names, no GIF |
| MS | `:::image type="content" source="..." alt-text="...":::`; `type="complex"` with long description; `type="icon"`; `border`, `loc-scope`, `lightbox` [unverified] | Border by default; long description visually hidden for screen readers | `alt-text` required for content and complex; build warns or errors [unverified level] |
| CF | Plain Markdown from `~/assets/images/<product>/` | Astro image pipeline | Guide: 500-600 px wide, 72 dpi |
| HC | `<ImageConfig>` and plain images | Border hidden in docs, shown in tutorials | None found |
| ST | Markdoc `Image`; `ignoreAltTextRequirement: true` seen | CDN images | Attribute implies alt text is enforced (inference) |
| **WSO2 option** | Keep Markdown; honour Material's `#only-light` / `#only-dark` fragments and `attr_list` `{ width="600" }` (5 sources also enable glightbox) | Converter: fragment pairs to `ThemedImage`, width to a style, zoom via a Docusaurus plugin (supply-chain review needed) | Check: missing alt text, external image URLs, oversize files |

## 10. Code block extras

| Site | Authoring syntax | Features | Validation |
|---|---|---|---|
| GH | ` ```yaml annotate `, ` ```js copy `, ` ```copilot copy prompt `, `{% prompt %}` | Two-pane annotations (only with `layout: inline`), copy header, "run in Copilot" button | Linter `code-annotations`, `code-annotation-comment-spacing` |
| GL | ` ```yaml {editable="true"} ` | `<PLACEHOLDER>` becomes an inline editable field, synced by name, kept in sessionStorage per page, copied with the reader's values; no highlighting in that block | None |
| CF | `title=`, `collapse={3-5}`, `showLineNumbers`, `wrap`, `ins=`, `del=`, marked strings; `<FileTree>`; `<PackageManagers pkg>` | Shiki via Nimbus, Expressive-Code-style meta | MDX compile |
| HC | `<CodeBlockConfig filename highlight="2,4" lineNumbers hideClipboard>`; `<CodeTabs>`; `shell-session` with `$` prompts | Filename header, highlight, copy | Style guide |
| MS | `:::code language source="file" range="2-24" id="snippet_x" highlight="2,5":::`; `azurecli-interactive` | Snippets pulled from sample repos; Cloud Shell "Try It" | Build resolves sources |
| ST | `CodeTooltip`, `ApiKey`, `File` with step mapping, `CodegenSnippet` | Hover hints on placeholders; reader's test keys | Closed |
| **WSO2 option** | Material: `title=`, `hl_lines`, `linenums`, annotations `# (1)!` (`content.code.annotate`), `--8<-- "file.java:section"` | Converter keeps `title` and highlights (built); add `showLineNumbers` for `linenums`; annotations need a custom MDX component | Check flags unsupported attributes instead of dropping them silently |

## 11. Config in two formats

| Site | Authoring syntax | Rendering | Validation | Degradation |
|---|---|---|---|---|
| CF | `<WranglerConfig>` around one ` ```toml ` or ` ```jsonc ` block; optional `cfConfig` | Generates the other format at build (`@iarna/toml`, `jsonc-parser`), injects `$schema`, shows synced tabs `wrangler.jsonc` / `wrangler.toml` | Build **throws** unless the only child is a TOML or JSONC block | n/a |
| GL | `tabs` per install method in a fixed order (Linux package, Helm chart, Operator, Docker, Self-compiled), each a full procedure | Tabs | Style guide fixes titles and order | n/a |
| Others | Tabs or prose | n/a | n/a | n/a |
| **WSO2 option** | Material tabs with fixed labels (`deployment.toml`, `Helm values.yaml`, `Console`) synced by section 7 | Synced tabs | Fixed label list in check | Generated TOML to YAML conversion is risky: `deployment.toml` keys do not map 1:1 to Helm values, so author both (GitLab model) |

## 12. Limits and quotas tables

| Site | Authoring syntax | Rendering | Validation |
|---|---|---|---|
| MS | Plain Markdown tables in per-service include files (`includes/api-management-service-limits.md`); the central Azure limits page pulls in 97 includes | Tables; columns vary by service (per tier), no fixed schema | None found |
| GL | Feature tables using `{{< yes >}}` / `{{< no >}}` icons; feature-flag table generated from data (`feature-flags` shortcode) | Tables | Data-driven where generated |
| CF | Plain tables; `PublicStats` from data | Tables | n/a |
| **WSO2 option** | Plain Markdown table in an include (contract already supports includes), included on product page and a hub "Limits" page | Table | Optional check of a header set (Name, Default, Adjustable) |

## 13. Quick-start metadata

| Site | Authoring syntax | Rendering | Validation |
|---|---|---|---|
| ST | Markdoc `ComplexityRating rating=2`, `ComplexityCallout`, `ComplexityCalloutRow` ("Integration effort", "Integration type") | Rating chips at the top of integration guides | Closed |
| CF | `difficulty:` front matter | Only a column in the `ListTutorials` table, not on the page | Zod string |
| HC | `readTime` in tutorial meta | Tutorials only, not docs (`components/tutorial-meta`) | n/a |
| GH | `complexity:` array front matter | Landing-page filters, not the article | AJV array |
| MS | `ms.topic: quickstart`, `ms.custom: mode-ui` | Metadata only | Learn build |
| **WSO2 option** | Existing `quick_start` front matter (parsed, unrendered) | Small strip under the title: time, difficulty | Converter validates values |

## 14. Topic types and front matter

| Site | Field | Values | Required? | Used for |
|---|---|---|---|---|
| GH | `contentType` | get-started, concepts, how-tos, reference, tutorials, homepage, landing, rai, other | Linter checks it matches the directory; `title` and `versions` are required | Navigation and checks |
| CF | `pcx_content_type` | concept, how-to, reference, tutorial, changelog, overview, navigation... | **Optional** in Zod; inferred for model and changelog pages | `<meta name="pcx_content_type">`, schema.org `@type` (changelog to BlogPosting, else TechArticle), resource filters |
| MS | `ms.topic` | quickstart, conceptual, how-to, include, contributor-guide... | Required with `title`, `description` (75-300 characters in the rules table; template comment says 115-145), `author`, `ms.author`, `ms.date` | Reporting, page type |
| GL | none for type; `title`, `description`, `stage`, `group`, `info` | n/a | Vale `FrontMatter.yml` errors without `title` | Ownership routing, feedback |
| HC | `page_title`, `description`; Diátaxis-based templates per product | n/a | Templates only | Search records |
| **WSO2 option** | `content_type` from a small enum, plus `title` and `description` | concept, task, reference, tutorial, troubleshooting, release-notes | Check warns on missing or unknown values; Docusaurus keeps unknown front matter (the converter already writes `quick_start`) | Emit as a meta tag and schema.org type, as CF does |

## Components research 17 missed

- **Editable code placeholders** (GL `{editable="true"}`) and **placeholder tooltips** (ST `CodeTooltip`). Fits WSO2's `<TENANT_DOMAIN>` style placeholders.
- **Code language tabs synced separately from tool tabs** (GH `codetabs` with a cookie; ST `CodeTabGroup pref="lang"`).
- **AI prompt blocks** with copy and "run in assistant" buttons (GH ` ```copilot ` and `{% prompt %}`).
- **Expiring content markers** that fail the lint after a date (GH `GHD038`; GL `start_remove`/`remove_date`).
- **Generated deprecations page from YAML data** (GL `data/deprecations`).
- **Feature flag alert type and generated feature-flag tables** (GL).
- **Page-level variant selectors** (MS zone pivots and `op_single_selector`), as opposed to in-page tabs.
- **Conditional steps** that follow the reader's language choice (ST `Step when`).
- **Interactive "Try It" code** (MS Cloud Shell). It runs in the vendor's product, so a WSO2 version needs security review.
- **Complex image long descriptions and `loc-scope`** (MS); **themed images by URL fragment** (Material `#only-light`).
- **Checklist** ("What you will learn") and **next-step button** (MS `[!div class=...]`).
- **Regional callout** with a country list (ST).
- **Guided walkthrough** driven by YAML data (GL `walkthrough`, experimental).
- **Do-not-translate marking** (MS `:::no-loc:::`). Relevant only if i18n returns.
- **CLI preference selector** across the site (CF Wrangler vs `cf`). This is a site-wide tool switcher.

## Corrections to research 17

- **B1 / B18:** Cloudflare `pcx_content_type` is optional in the current schema (`src/schemas/base.ts`), not required.
- **B8:** GitLab `guide` is confirmed (`_shortcodes/guide.html`), not unverified. Its style guide limits it to tutorials, and it degrades to a plain list in product help.
- **B9:** The WSO2 gap is wider than "no `groupId`". The converter assigns positional `value="tab-N"`, so a `groupId` alone would sync the wrong tabs. Six content sources already rely on Material's label-linked tabs. Add HashiCorp (`group`) and Stripe (`pref`) to "Seen on".
- **B10:** GitHub also has `defaultPlatform` with OS detection from the user agent, and URL `?tool=`.
- **B11:** The alert sets differ by site. GitHub and Microsoft have five; GitLab has `note`, `flag`, `warning` and `disclaimer` only. "flag" and "disclaimer" are GitLab only.
- **B14:** Five content sources (api-platform, choreo, is, mi, security) enable `glightbox`, so lightbox is an existing author expectation, not a new feature.
- **B15:** GitHub `annotate` works only with `layout: inline`. Material already supports annotations at source.
- **B16:** Cloudflare `WranglerConfig` generates the second format at build and throws on bad input. Its TOML library has been unmaintained since 2020.
- **B17:** Among the six reference sites, only Microsoft has a central limits page, and it has no fixed schema. The Name / Default / Adjustable schema came from AWS and Google Cloud.
- **B22:** HashiCorp `readTime` is for tutorials only. Cloudflare `difficulty` shows only in tutorial lists. Stripe's "Integration effort" is a `ComplexityRating` tag.
- **B2:** Cloudflare's style guide now advises against inline badges.

## Sources

- GitHub: `github/docs` at be38ec5: `src/content-render/liquid/{codetabs,prompt,tool}.ts`, `src/frame/lib/frontmatter.ts`, `src/frame/components/CodeTabsGroup.tsx`, `src/frame/components/ui/PermissionsStatement/`, `src/tools/components/{InArticlePicker,PlatformPicker}.tsx`, `src/content-linter/lib/linting-rules/{expired-content,outdated-release-phase-terminology,frontmatter-content-type}.ts`, `content/contributing/style-guide-and-content-model/{contents-of-a-github-docs-article,style-guide}.md`, `content/contributing/writing-for-github-docs/{creating-tool-switchers-in-articles,using-markdown-and-liquid-in-github-docs}.md`
- GitLab: `docs-gitlab-com` at 5dec2ec: `themes/gitlab-docs/layouts/_shortcodes/{guide,history,details,alert,tabs,tab,ui,walkthrough,feature-flags}.html`, `_markup/{render-blockquote,render-image,render-codeblock}.html`, `src/utils/editable_code.js`, `src/components/tabbed_content.vue`. `gitlab-org/gitlab` master: `doc/development/documentation/styleguide/{_index,availability_details,deprecations_and_removals}.md`, `topic_types/{_index,task}.md`, `metadata.md`, `feature_flags.md`, `doc/.vale/gitlab_base/*`, `doc/.vale/gitlab_docs/*`, `data/deprecations/templates/example.yml`
- Cloudflare: `cloudflare-docs` at 4e761ed: `src/components/ui/{steps,tabs,cli-preference}/`, `src/components/cf/WranglerConfig.astro`, `src/schemas/base.ts`, `src/util/page-head.ts`, `src/content/docs/style-guide/build-the-page/components/*.mdx`, `documentation-content-strategy/component-attributes/*.mdx`, `style-and-grammar/formatting/code-block-guidelines.mdx`; npm `@cloudflare/nimbus-docs@0.15.0`, `@iarna/toml`
- HashiCorp: `dev-portal` at aaf0891: `src/components/dev-dot-content/index.tsx`, `mdx-components/mdx-code-blocks/`, `src/components/tabs/hooks/use-synced-tab-groups.ts`, `src/views/docs-view/utils/get-docs-mdx-components.ts`, `src/layouts/sidebar-sidecar/utils/_local_platform-docs-mdx/`. `web-unified-docs` (BUSL, read only): `docs/content-guide/{content-types.md,templates/usage.mdx}`, `docs/style-guide/{ui-components.md,codeblocks-and-consoles/}`, `scripts/prebuild/mdx-transforms/paragraph-custom-alert/`
- Microsoft: `MicrosoftDocs/Contribute` `Contribute/content/{markdown-reference,metadata,code-in-docs,how-to-write-major-edits,get-started-setup-tools}.md`; `dotnet/docfx` `docs/docs/markdown.md`; `MicrosoftDocs/azure-docs` `articles/azure-resource-manager/management/azure-subscription-service-limits.md`, `includes/api-management-service-limits.md`, preview includes; live https://learn.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-portal
- Stripe: live Markdoc render trees in https://docs.stripe.com/payments/accept-a-payment, /payments/quickstart, /payments/checkout, /billing/subscriptions/build-subscriptions, /connect/onboarding, /stripe-cli, and https://docs.stripe.com/payments/accept-a-payment.md
- Material for MkDocs: `squidfunk/mkdocs-material` `docs/reference/{content-tabs,index,images,code-blocks,tooltips}.md`, `src/overrides/hooks/shortcodes.py`
- WSO2: `docs-site/packages/docs-converter/src/syntax.ts`; `mkdocs.yml` of fetched sources under `docs-site/.cache/sources/` (features and plugins only)
