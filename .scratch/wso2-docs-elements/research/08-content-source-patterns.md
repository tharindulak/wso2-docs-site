# 08 Patterns writers already hand-build in our content sources (researched 2026-10-12)

Answers [issue 08](../issues/08-content-source-patterns.md).

Scope: the Latest content of every section in `docs-site/content-sources.yaml` (15 repos, 23 counting buckets, 7,214 Markdown/MDX files). Planning input for review by the docs team; nothing here is decided.

## TL;DR

- **Prerequisites** is the most repeated hand-built block: 1,288 pages in 22 of 23 buckets. 865 pages use exactly `## Prerequisites`. Detection by heading text is reliable; "Before you begin" admonitions add 157 more blocks.
- **`Step N` headings** appear on 1,035 pages in 13 repos. 81% use `Step N:` (colon); APIM and APK mostly use `Step N -`. 121 pages restart numbering (often one procedure per tab or option), 55 use sub-steps (`Step 2.1`). The headings are easy to detect; telling where a procedure starts and ends is harder.
- **Closings**: 844 pages end with a "What's next" / "Next steps" / "Related topics" / "See also" heading. 11 wordings exist; most of them come from WSO2 Integrator. Detectable by heading text.
- **Tabs**: 678 MkDocs pages, about 1,700 tab groups and 424 distinct labels. Console vs CLI vs API tabs are almost absent (6 groups). The real families are OS (28 label spellings), request/response/format, and Visual Designer vs code. Material's linked tabs (`content.tabs.link`) are already on in 7 of 14 MkDocs configs and only sync identical labels, so synced tabs would need a label normalization map.
- **Version notes** are rare and mostly IS "available from **update level X** onwards" sentences (26 pages). **Beta/Experimental/Deprecated** labels: 45 pages, in 4 forms. **Required roles/permissions** are free prose (388 pages, loosely matched) and cannot be detected reliably.
- **Admonitions**: `note` dominates (5,248 MkDocs + 441 Docusaurus). 2,112 are collapsible (`???`). There are custom or typo types (`prerequisites`, `optional`, `infor`, `warn`).
- Structured data already exists in a few places: 35 IS quick-start pages carry a `<script> const meta` block (`what_you_will_learn`, `prerequisites`, `source_code`, `whats_next`), and security advisories carry `severity` / `cvss` front matter.

## Summary

Pages are files matching at least once, with fenced code removed. "Buckets" are the 23 counting units below. "Repos" are out of 15.

| Pattern | Pages | Buckets | Repos | Detectable automatically? |
|---|---|---|---|---|
| `Step N` headings | 1,035 | 21 | 13 | Yes for the heading; partly for procedure boundaries |
| Sub-step headings (`Step 2.1`) | 55 | 12 | 9 | Yes |
| Numbered headings (`### 1. Foo`) | 91 | 17 | 12 | Partly (also used for non-procedures) |
| Prerequisites (heading, admonition or bold) | 1,288 | 22 | 14 | Yes (heading or admonition title); bold form partly |
| Required roles / permissions / scopes phrase | 388 | 22 | 14 | No (prose; many hits are API reference text) |
| Update-level availability note | 26 | 5 | 4 | Yes for the IS template sentence; no otherwise |
| Version availability note (`from 4.1.0 onwards`) | 16 | 7 | 6 | No |
| Status label (Beta / Experimental / Deprecated) in heading, admonition title or `(label)` | 45 | 14 | 9 | Mostly yes |
| Any Beta / Preview / Experimental / Deprecated word | 235 | 22 | 14 | No (mostly ordinary prose, such as "preview panel") |
| Closing heading (next steps family) | 844 | 18 | 11 | Yes |
| MkDocs tabs (`=== "..."`) | 678 | 18 | 10 | Yes (syntax); labels need normalizing |
| Docusaurus tabs (`<TabItem>`) | 85 | 3 | 3 | Yes |
| MkDocs admonitions | 2,757 | 21 | 13 | Yes |
| Collapsible admonitions (`???`) | 336 | 18 | 12 | Yes |
| Docusaurus admonitions (`:::`) | 410 | 3 | 3 | Yes |
| Raw HTML `class=` | 957 | 17 | 10 | Yes (syntax); meaning varies by class |
| Image `{: width=... }` / `{: .cInlineImage-* }` | 601 / 87 | 12 / 5 | 6 / 3 | Yes |
| `{% include %}` / `{% if %}` | 1,132 / 262 | 5 / 3 | 3 / 1 | Yes (already handled in the build) |
| `{{ variable }}` | 2,696 | 17 | 11 | Yes |
| Quick-start `<script> const meta` | 35 | 2 | 1 | Yes (the converter already parses it) |
| Raw `<table>` / `<details>` | 727 / 233 | 15 / 11 | 12 / 9 | Yes |
| Mermaid | 207 | 2 | 2 | Yes |
| "What you'll build" / "Learning objectives" | 315 | 9 | 7 | Yes |
| "Troubleshooting" H2/H3 | 86 | 17 | 11 | Yes |

## Sections counted (Latest)

From `docs-site/content-sources.yaml`: for a versioned section, its first `versions:` entry (`track: true`); otherwise the section's `sha`. Snapshot folders use the first 12 SHA characters. MkDocs docs root is `docs/` next to the `mkdocs.yml` (no config sets `docs_dir`).

| Bucket | Snapshot and path | Files | In nav |
|---|---|---|---|
| integrator | `docs-integrator@0420342f8bcd/en/docs` (Docusaurus) | 1,164 | not checked |
| devant | `docs-devant@2928db6211fd/en/docs` (cloud companion of Integrator) | 66 | 63 |
| mi-4.6.0 | `docs-mi@16f84ae6e39b/en/docs` | 875 | 842 |
| bi | `docs-bi@b5618c07948f/en/docs` | 102 | 99 |
| si-4.4.0 | `docs-si@9c75a9781262/en/docs` | 222 | 187 |
| asgardeo | `docs-is@c2176fcd1b50/en/asgardeo/docs` | 698 | 655 |
| is-7.3.0 | `docs-is@c2176fcd1b50/en/identity-server/7.3.0/docs` | 851 | 782 |
| is-includes | `docs-is@c2176fcd1b50/en/includes` (shared partials, not pages) | 726 | n/a |
| agent-manager | `docs-agent-platform@58da5a82a4d1/versioned_docs/version-v1.0.0` | 72 | not checked |
| api-platform | `docs-api-platform@f7a46e1d7d8b/en/docs` minus the `skip:` folders | 43 | 43 |
| api-gateway-1.2.0, ai-gateway-2026.09.24, api-portal-1.0.0, ai-workspace-1.0.0 | same snapshot, `docs_root` folders | 58, 86, 72, 63 | 58, 84, 72, 63 |
| bijira-cloud | same snapshot, `cloud/` (cloud companion of API Manager) | 200 | 184 |
| apim-4.7.0 | `docs-apim@75726eb0a49d/en/docs` | 595 | 547 |
| apk-1.3.0 | `docs-apk@7dbf5736c5c7/en/docs` | 252 | 172 |
| choreo-dev, choreo-pe | `docs-choreo-dev@eca033c47c57/en/{developer,pe}-docs/docs` | 171, 92 | 158, 88 |
| healthcare | `open-healthcare-docs@e2512a025498/en/docs` (Docusaurus) | 101 | not checked |
| open-banking-4.0.0 | `docs-open-banking@81100957b685/en/docs` | 179 | 139 |
| updates | `docs-updates@0e2e93c9030a/en/docs` | 36 | 34 |
| security | `docs-security@f2bf5be51976/en/docs` | 490 | 488 |

**Pages outside the published nav are included.** For MkDocs, 393 of 5,151 files (7.6%) are not in `nav:`. Most are `includes/` partials (MI, APIM, APK, Open Banking) or orphan pages. The `exclude:` lists in the lock file were not subtracted (a handful of pages). The IS shared `includes/` folder is counted as its own bucket because most IS and Asgardeo pages are one-line `{% include %}` stubs (1,054 of 1,549 pages): without it, IS patterns would be invisible. A pattern inside an include renders on both IS sites but is counted once.

## Step N procedure headings

- **Pages:** 1,035 in 21 buckets. The largest are integrator (409, many generated-looking connector `example.md` / `setup-guide.md` pages), APIM (151), MI (69), BI (50), IS includes (49) and Choreo dev (48). Updates and Security have none.
- **Separator** (5,550 headings): colon `Step 1:` 4,504; hyphen `Step 1 -` 639 (APIM 326, APK 123, MI 89, BI 55); period `Step 1.` 256 (Choreo dev 68, APIM 45); em dash 111 (APIM 92); en dash 23; none 17. Some sites mix several forms. Example: APK `Step 1 – Add the Model-Based Round Robin Policy...` (`create-api/.../model-based-round-robin-via-rest-api.md`) next to `## Step 2. Obtain the API Key...`.
- **Level:** H3 2,827, H2 2,372, H4 309, H5 35, H1 7 (SI's `get-started/first-siddhi-app/*` pages use `# Step N` as the page title, continuing the numbering across pages, starting at 2, 3, 6 and 7).
- **Numbering:** across the 1,035 pages, 121 restart (examples: integrator `connectors/catalog/built-in/http/example.md` `[1..5, 1..9]`; `api-portal/1.0.0/quickstart-guide.md` restarts five times), 22 skip a number (`devant/sharing-and-reusing/use-a-connection-in-your-integration.md` `[1, 3, 4]`), 11 do not start at 1, and 63 mix heading levels. Sub-steps (`### Step 2.1`) are on 55 pages; Choreo dev alone has 21. Many restarts are legitimate: two alternative procedures on one page, or one procedure per tab.
- **Other forms:** bold `**Step 1**` lines (32 pages); numbered headings `### 1. Foo` (91 pages, also used for non-procedural lists such as `apim-4.7.0/.../am-pattern-6-all-in-one-is-as-km.md` `### 1. Image and Registry`).
- **Detectable?** The heading is reliable: `^#{1,6}\s+(\*\*)?Step\s*-?\s*\d+(\.\d+)?` followed by any of `: - . – — )`. Grouping into one procedure component is not reliable without author input, because of restarts, alternative procedures and sub-steps. A safe converter rule: style each Step heading consistently (number badge) and leave the grouping alone.

## Prerequisites / "Before you begin"

- **Pages:** 1,288 in 22 buckets (all but Security). Integrator 433, IS includes 153, SI 112, MI 94, APIM 63, Choreo dev 61, Bijira cloud 60.
- **Heading wording** (1,125 headings): Prerequisites 1,008, Before you begin 66, Before you start 20, Prerequisite 13, What you need 8, Requirements 5, What you'll need 3, Pre-requisites 2. `## Prerequisites` alone is on 865 pages; it is the most common H2 across all sources.
- **Admonition form** (227): `!!! tip "Before you begin"` / `"Before you begin:"` / `"Before you begin..."` (Open Banking, SI), `!!! note "Before you begin"` (IS), `!!! info "Prerequisites"` (Bijira), `:::info Prerequisites` (integrator). The custom admonition types `!!! prerequisites` and `!!! prerequisite` occur 7 times.
- **Bold form** (48): `**Before you begin:**` (APIM), `**Prerequisites**:` (Choreo, Bijira).
- **Structured form:** the 35 IS quick-starts list `prerequisites:` in their `<script> const meta` block (see "Front matter and page metadata").
- **Detectable?** Yes for headings and admonition titles, using the wording list above (case-insensitive, with an optional trailing colon or ellipsis). The block ends at the next heading of the same or higher level, or at the end of the admonition. The bold form has no clear end, so only partly.

## Required roles or permissions

- **Pages:** 388 match a loose phrase (`required|requires|must have|need` within 60 characters of `role|permission|privilege|scope`). Many hits come from generated REST API reference text (`<aside>` and "Required scopes" in API Portal and AI Workspace `platform-api/*`, "required roles" in API Gateway and AI Gateway) or from third-party setup steps (integrator connector `setup-guide.md`: "requires Global Administrator or Privileged Role Administrator permissions").
- **Hand-written forms** (171 pages for a tighter phrase): "you must have the `ENVIRONMENT-MANAGEMENT` permission" (Choreo PE `infrastructure/environments/manage-environments.md`), "a user must have the following permissions" (Choreo PE workflows), "the user must have a role that includes admin privileges" (`is-7.3.0/apis/scim-1.1-apis.md`). Only 5 headings name it (`## Configure required scopes`, `### Required scopes`). No admonition type or title is used for it consistently.
- **Detectable?** No. A "Required roles" component would need authors to adopt it.

## Version and feature-history notes

- **Update-level notes** (26 pages, 5 buckets): IS repeats a near-template sentence, "This feature is available from **update level 7.3.0.12** onwards. See the instructions on [updating WSO2 products](...)" (`is-includes/consent-management/preference-management-consent.md`, `is-includes/guides/authorization/delegation.md`, `is-7.3.0/get-started/about-this-release.md`). Variants: "available starting from update level 7.2.0.13" and "From update level 135 onwards" (IS); "available in WSO2 API Manager 4.7.0 starting from update level 6" (APIM); "available from **update level 1.2.0.2** onwards" (API Gateway).
- **Version notes** (16 pages): "available from version 2.5.0" (MI connector references), "From version 4.1.0 onwards" (APIM), "What Is New in V2.0.0" (Gateway Kubernetes overview). "Introduced in" and "since X.Y" do not occur as version notes.
- "Update level" also appears in 156 Security advisories and 12 Updates pages, but as content about updates, not as availability notes.
- **Detectable?** The IS template (`available from **update level X** onwards`) is regular enough to render as a badge. The rest is prose.

## Beta, Preview, Experimental, Deprecated

- **Word anywhere:** 235 pages, mostly ordinary prose ("preview panel", "deprecated keys" tables). Feature-status labels proper are on 45 pages, in four forms:
  - Heading suffix: `# Develop a Webhook (Deprecated)` and `# Test Components with Test Runner (Deprecated)` (Choreo dev), `## Generating a client from a GraphQL schema (experimental)` (integrator), `## Deprecated features` (IS release notes).
  - Admonition title: `!!! warning "Beta feature"` (IS `flows/flow-ai.md`, `branding/branding-ai.md`, `authentication/login-flow-ai.md`), `!!! warning "Deprecated feature"`, `!!! danger "Deprecated feature"` (APIM), `:::caution Experimental feature`, `:::note Beta` (integrator), `!!! warning "Deprecated Documentation"` (Open Banking `includes/deprecated-banner.md`).
  - Parenthesis in text or a tab label: `(Deprecated)` 48 times, for example the tab `=== "NGINX Ingress Controller (Deprecated)"` on 35 APIM Kubernetes pattern pages; `(Beta)` / `(experimental)` 11 times.
  - Nav label: BI `Natural functions(Beta)`, IS `Roles v1 API (deprecated)` and 6 other API entries, APIM `Legacy API Keys (DEPRECATED)`, three Choreo `(Deprecated)` entries.
- No badge HTML or front matter field marks status anywhere.
- **Detectable?** Mostly, for the heading suffix, admonition title and nav label forms (match `\((beta|preview|experimental|deprecated)\)` case-insensitively at the end of a title). Prose mentions are not.

## Closings: Next steps, Related topics, What's next

- **Pages:** 844 in 18 buckets. On most of them it is the last H2. Heading wording (excluding Security's "References", which lists CVE links): What's next 439 (integrator 349, MI 50, APIM 17), Next steps 166, Related topics 61 (AI Gateway 28, Healthcare 18), See also 60 (APIM 31), Additional resources 9, Related documentation 7, Learn more 5, Next step 3, Related guides 3, Related links 1. 77 pages write "What's next?" with a question mark. The admonition form `!!! tip "What's next?"` appears 11 times.
- Healthcare, Open Banking, Updates, SI, Devant and Choreo dev have almost none.
- **Detectable?** Yes, by heading text (list above, with an optional trailing `?`). The body is usually a bullet list of links. A converter could render it as a "next steps" card list without author changes.

## Tab groups and label consistency

- **Volume:** 678 MkDocs pages, about 1,700 groups, 3,820 tab labels, 424 distinct labels. Docusaurus has 85 pages (integrator 76, `<Tabs>` 204 times). MI (502 groups), IS includes (351), APIM (349) and APK (176) use tabs most.
- **Most common groups:** `Format | Example` 122 (config references), `Request | Response` 99, `On MacOS/Linux | On Windows` 93, `Command | Format` 61, `npm | yarn | pnpm` 41, `Virtual machine | Kubernetes` 39, `Classic Editor | Visual Editor` 37, `Java stack | Go stack` 36, `Envoy Gateway (Recommended) | NGINX Ingress Controller (Deprecated)` 35. Integrator's Docusaurus tabs are mostly `Visual Designer` / `Ballerina Code` (184 / 188).
- **Console / CLI / API:** almost absent. Only 6 groups mix them (`Using the Console | Using the API` 4, `Use the Console | Use the API` 2). CLI-type labels are mostly `Command` (96).
- **OS labels:** 542 tabs, 28 spellings: `On Windows` 137, `On MacOS/Linux` 93, `Windows` 85, `On macOS/Linux` 35, `Linux / macOS` 22, `Linux/Mac OS` 18, `Linux/Unix` 15, `Linux/macOS` 14, `macOS/Linux` 9, `Mac/Windows` 7, `macOS / Linux` 6, and others.
- **Request labels:** `Sample request` 52 vs `Sample Request` 50, `Request format` 28 vs `Request Format` 39.
- **Language labels:** `Java`, `Go`, `Python`, `NodeJS`, `.NET`, `PHP`, `Ruby` appear once to four times each. Language tabs are not a big pattern.
- **Synced tabs today:** Material's `content.tabs.link` (it syncs tabs with identical labels) is on in MI, BI, SI, APIM, Devant, IS (base.yml) and Security. It is off in API Platform, APK, Choreo, Open Banking and Updates. Open Banking and Updates do not enable `pymdownx.tabbed` at all. Agent Manager uses Docusaurus `groupId` on 5 pages (`vm-installer`, `deployment-mode`, `tls-issuer`).
- **Detectable?** The syntax, yes. For synced tabs, the labels need a normalization map (for example every OS spelling mapped to `linux-macos` / `windows`) applied at conversion. Matching only identical labels would split a reader's choice across today's spelling variants.

## Admonition types

Counts are occurrences. Of the MkDocs admonitions, 7,170 are blocks (`!!!`) and 2,112 collapsible (`???` / `???+`).

| Type | MkDocs | Docusaurus (`:::`) |
|---|---|---|
| note | 5,248 | 441 |
| info | 1,807 | 170 |
| tip | 1,117 | 299 |
| warning | 490 | 127 |
| example | 291 | 0 |
| important | 152 | 0 |
| abstract | 61 | 0 |
| danger | 56 | 5 |
| details | 16 | 0 |
| caution | 0 | 10 |
| others: attention 7, success 6, prerequisites 4, optional 4, prerequisite 3, warn 2, troubleshooting 2, limitation 2, failure 2, notes 2, infor 1, infox 1, and more | about 40 | 0 |

`important`, `attention`, `prerequisites`, `optional`, `limitation`, `notes` and the typos are not standard Material types. They depend on theme CSS (`assets/css/admonition.css` in IS) or fall back to the default style. The most common titles: "Note" 143, "Before you begin" 118, "Important" 76, "Approval required" 19, "What's next?" 11, "Documentation in progress" 9.

## MkDocs extensions

All 14 MkDocs configs (INHERIT resolved for IS) enable: `admonition`, `def_list`, `footnotes`, `toc`, `pymdownx.arithmatex`, `betterem`, `caret`, `critic`, `details`, `emoji`, `keys`, `mark`, `smartsymbols`, `superfences`, `tasklist`, `tilde`. The differences:

| Extension | Configs | Missing in |
|---|---|---|
| `attr_list` | 13 | Open Banking |
| `pymdownx.snippets` | 13 | Updates |
| `pymdownx.tabbed` | 12 | Open Banking, Updates |
| `pymdownx.inlinehilite` | 11 | API Platform, Choreo dev, Choreo PE |
| `markdown_include.include` | 8 | IS (both), API Platform, Choreo (both) |
| `meta` | 6 | most |
| `pymdownx.highlight` | 6 | most (others use `codehilite`, 4) |
| `md_in_html` | 1 | all but API Platform |

Plugins in use: `markdownextradata` (variables, 12 configs), `redirects`, `exclude`, `include-markdown` (IS, API Platform, Choreo, Security), `glightbox` (MI, IS, API Platform, Choreo, Security), `open-in-new-tab`, `git-revision-date-localized` (SI), `minify` (Security). `pymdownx.keys` is enabled everywhere, but no page uses `++key++`. Content still nests Markdown inside HTML where `md_in_html` is off (the raw `<table>` and `<details>` counts below), so the converter cannot rely on the extension list to know where that happens.

## Custom HTML classes and CSS in content

957 pages carry raw `class=`. The repeated sets:
- **Config catalog** (`mb-config-catalog`, `param-*`, `badge-required`, `superfences-tabs`, `tab-selector`): 4 pages (MI, APIM, Open Banking `reference/config-catalog.md`), but 274 entries and 721 "Required" badges in them.
- **Security advisories:** `<p class="doc-info">Published: ...</p>` on 437 pages (1,639 times).
- **Generated REST API docs:** `<aside class="warning">` on 46 pages (API Gateway, AI Gateway, API Portal, AI Workspace).
- **Image sizing:** `{: .cInlineImage-full }` and `-half`, `-threeQuarter`, `-small`, `-xsmall` (87 pages: Choreo, Devant, Bijira). Width or style attr_lists on images: 601 pages. MI writes `class="glightbox"` by hand 902 times.
- **Cards and grids:** `card`, `cards-container`, `guides-cards`, `centered-container`, `square` (14 pages, landing pages).
- **Pasted HTML from older tools:** Confluence (`confluenceTd`, `panel`, `panelContent`, `code`, `codeContent`), pandoc highlighting (`sourceCode`, `kw`, `op`, `st`), and `odd` / `even` table rows (SI, IS).
- `extra_css` per site ranges from 1 file (Security) to 8 (MI). Common files: `theme.css`, `json-formatter.css`, `config-catalog.css`, fontawesome. Choreo also loads `region-selector.css`.
- **Detectable?** The syntax, yes. The meaning has to be mapped class by class. Config catalog, `doc-info`, `cInlineImage-*` and cards are worth explicit mappings. The pasted Confluence and pandoc classes can be dropped.

## Front matter and page metadata

| Key | Pages | Where |
|---|---|---|
| `title` | 2,185 | 17 buckets |
| `description` | 1,231 | 11 |
| `template` | 628 | 14 (IS: `redoc.html` 239, `complete-guide.html` 209, `sdk.html` 84, `quick-start.html` 36, `connector.html` 13) |
| `tags` | 520 | 10 |
| `author`, `canonical_url`, `md_url`, `last_updated`, `content_type` | 503 each | API Platform family only (every page) |
| `category`, `published`, `severity`, `cvss`, `version` | 484, 366, 328, 319, 299 | Security advisories |
| `heading`, `read_time`, `heading_meta` | 297, 212, 80 | IS SDK and complete-guide pages |
| `connector`, `connector_name`, `keywords`, `toc_max_heading_level` | 233, 233, 199, 197 | Integrator connector catalog |
| `sidebar_position`, `sidebar_label`, `slug` | 291, 18, 11 | Docusaurus |
| `search` | 65 | MI, IS (search boost or exclusion) |

**`quick_start`**: no source uses a `quick_start` front matter key. The converter builds `quick_start` from a `<script> const meta = {...}</script>` block (`docs-site/packages/docs-converter/src/page.ts:135`, `html-policy.ts:47`). That block is on 35 IS pages: 23 Asgardeo (22 `quick-starts/`, 1 `sdks/`) and 12 IS 7.3.0 `quick-starts/`. Its keys are `what_you_will_learn` 35, `prerequisites` 35, `source_code` 28 and `whats_next` 6. Values are HTML strings with `{{ base_path }}` links. Asgardeo also has `features.json`, a feature-flag map from feature to pages.

## Other repeated hand-built patterns

- **Tutorial intro:** `## What you'll build` / `## Learning objectives` / `## What you'll learn` on 315 pages (integrator 194, MI 94). Pairs naturally with Prerequisites and What's next as a tutorial frame.
- **Try it / Verify:** headings `Try it out`, `Try it yourself`, `Verify`, `Test the ...` on 430 pages in 20 buckets.
- **Troubleshooting** H2/H3 on 86 pages in 17 buckets.
- **Product variables and conditionals:** `{{base_path}}` 12,794 times (link prefix), `{{ product_name }}` / `{{product_name}}` 6,074. In IS includes, `{% if product_name == ... %}` branches on 257 pages: hand-built cloud vs self-hosted variants inside one file.
- **Connector catalog:** integrator has about 233 connectors with the same page set (`overview`, `actions.md` with one `<details>` per operation: 9,164 `<details>` on 207 pages; `example.md` with `## What you'll build` and Step headings; `setup-guide.md`). MI has 42 `## How to contribute` connector pages. These look generated; check with the owners before treating them as hand-built.
- **Mermaid:** 207 pages (integrator 199, Agent Manager 8).
- **Raw HTML tables:** 727 pages in 15 buckets, often for merged cells or nested lists that Markdown tables cannot hold.

## Method

1. Read `docs-site/content-sources.yaml` with PyYAML. For each section, took the first `versions:` entry's `sha` (Latest, `track: true`), or the section's own `sha`, plus `cloud_companion` sources; mapped the result to `docs-site/.cache/sources/wso2__<repo>@<sha[:12]>` and the docs root (MkDocs `docs/` beside `mkdocs.yml`, `docs_root`, or Docusaurus `docs:`), honouring `skip:` / `only:`.
2. Walked `.md` / `.mdx` files, removed fenced code blocks (except when counting Mermaid and the meta script), and matched line regexes. A page counts once per pattern.
3. Nav coverage: parsed `nav:` from each `mkdocs.yml` (INHERIT resolved; custom YAML tags ignored) and intersected it with the file list.
4. Tab groups: consecutive `=== "..."` lines at the same indent with only indented or blank lines between them.

Rerun from the repo root (PyYAML is not needed for this script):

```sh
python3 patterns08.py docs-site/.cache/sources        # summary table
python3 patterns08.py docs-site/.cache/sources tabs   # tab labels, admonition types
```

`patterns08.py` (the per-pattern figures in the sections above came from a longer version of the same scan, with separator, level and numbering checks and per-bucket breakdowns):

```python
#!/usr/bin/env python3
import os, re, sys, collections
SRC = sys.argv[1] if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]) else 'docs-site/.cache/sources'
MODE = sys.argv[-1]
IS = 'wso2__docs-is@c2176fcd1b50/en'
AP = 'wso2__docs-api-platform@f7a46e1d7d8b/en'
SECTIONS = {  # bucket -> (mkdocs.yml or None, docs root, skip prefixes)
  'integrator': (None, 'wso2__docs-integrator@0420342f8bcd/en/docs', []),
  'devant': (None, 'wso2__docs-devant@2928db6211fd/en/docs', []),
  'mi-4.6.0': (None, 'wso2__docs-mi@16f84ae6e39b/en/docs', []),
  'bi': (None, 'wso2__docs-bi@b5618c07948f/en/docs', []),
  'si-4.4.0': (None, 'wso2__docs-si@9c75a9781262/en/docs', []),
  'asgardeo': (None, IS + '/asgardeo/docs', []),
  'is-7.3.0': (None, IS + '/identity-server/7.3.0/docs', []),
  'is-includes': (None, IS + '/includes', []),
  'agent-manager': (None, 'wso2__docs-agent-platform@58da5a82a4d1/versioned_docs/version-v1.0.0', []),
  'api-platform': (None, AP + '/docs', ['cloud/', 'api-manager/', 'next/', 'api-gateway/', 'ai-gateway/', 'api-portal/', 'ai-workspace/']),
  'api-gateway-1.2.0': (None, AP + '/docs/api-gateway/1.2.0', []),
  'ai-gateway-2026.09.24': (None, AP + '/docs/ai-gateway/2026.09.24', []),
  'api-portal-1.0.0': (None, AP + '/docs/api-portal/1.0.0', []),
  'ai-workspace-1.0.0': (None, AP + '/docs/ai-workspace/1.0.0', []),
  'bijira-cloud': (None, AP + '/docs/cloud', []),
  'apim-4.7.0': (None, 'wso2__docs-apim@75726eb0a49d/en/docs', []),
  'apk-1.3.0': (None, 'wso2__docs-apk@7dbf5736c5c7/en/docs', []),
  'choreo-dev': (None, 'wso2__docs-choreo-dev@eca033c47c57/en/developer-docs/docs', []),
  'choreo-pe': (None, 'wso2__docs-choreo-dev@eca033c47c57/en/pe-docs/docs', []),
  'healthcare': (None, 'wso2__open-healthcare-docs@e2512a025498/en/docs', []),
  'open-banking-4.0.0': (None, 'wso2__docs-open-banking@81100957b685/en/docs', []),
  'updates': (None, 'wso2__docs-updates@0e2e93c9030a/en/docs', []),
  'security': (None, 'wso2__docs-security@f2bf5be51976/en/docs', []),
}
PRE = r'^#{1,6}\s+(\*\*)?'
PAT = {
 'step headings': [r'^#{1,6}\s+(\*\*)?Step\s*-?\s*\d+'],
 'step sub-numbers (Step 1.2)': [r'^#{1,6}\s+(\*\*)?Step\s*\d+\.\d+'],
 'bold step lines': [r'^\s*(\d+\.\s+)?\*\*Step\s*\d+'],
 'prerequisites (heading/admonition/bold)': [PRE + r'(prerequisites?|pre-requisites?|before you begin|before you start|requirements|what you(\'ll| will)? need)\b', r'^\s*(!!!|\?\?\?\+?|:::)\s*\w+\s+"?(prerequisites?|before you begin|before you start)', r'^\s*\*\*(prerequisites?|before you begin|before you start)\s*:?\*\*'],
 'required roles/permissions/scopes phrase': [r'\b(required|requires|must have|need(s)?)\b[^.\n]{0,60}\b(roles?|permissions?|privileges?|scopes?)\b'],
 'update-level availability note': [r'(available|supported|applicable|introduced|starting)[^.\n]{0,25}(from|in|since|with)\s+(\*\*|`)*\s*update level\s*(\*\*|`)*\s*[\d.]+|from update level\s*(\*\*|`)*[\d.]+'],
 'version availability note': [r'\bavailable (only )?(from|in|since|starting( from)?) (version |v|wso2 [\w ]{0,30}?)?\d+\.\d+', r'\bfrom (version |v)?\d+\.\d+(\.\d+)? onwards', r'\b(introduced in|new in|added in)\s+(version\s+|v)?\d+\.\d+'],
 'status label in heading, admonition or (label)': [r'^#{1,6} .*\b(beta|experimental|deprecated)\b', r'^\s*(!!!|\?\?\?\+?|:::)\s*\w+.*\b(beta|preview|experimental|deprecated)\b', r'\((beta|experimental|deprecated)\)'],
 'any Beta/Preview/Experimental/Deprecated word': [r'\b(beta|preview|experimental|deprecated)\b'],
 'closing heading (next steps family)': [r"^#{2,6}\s+(\*\*)?(next steps?|what'?s next\??|related topics|related links|related guides|related documentation|see also|learn more|further reading|additional resources)\s*\**\s*$", r'^\s*(!!!|\?\?\?\+?|:::)\s*\w+\s+"?(what\'?s next|next steps?|related topics|see also)'],
 'MkDocs tabs': [r'^\s*===\+?\s+"'],
 'Docusaurus tabs': [r'<TabItem\b'],
 'MkDocs admonitions': [r'^\s*(!!!|\?\?\?\+?)\s*\w'],
 'Docusaurus admonitions': [r'^\s*:::\s*\w'],
 'collapsible admonitions': [r'^\s*\?\?\?\+?\s*\w'],
 'raw HTML class attribute': [r'\bclass(Name)?=["\']'],
 'cInlineImage class': [r'\{:?\s*\.cInlineImage'],
 'image attr_list': [r'!\[[^\]]*\]\([^)]*\)\s*\{'],
 'Jinja include': [r'\{%-?\s*include\b'],
 'Jinja conditional': [r'\{%-?\s*if\b'],
 'variable': [r'\{\{\s*[\w.]+\s*\}\}'],
 'quick-start <script> meta': [r'^\s*(const|let|var)\s+meta\s*='],
 'raw <table>': [r'<table\b'],
 'raw <details>': [r'<details\b'],
 'mermaid diagrams': [r'^\s*```\s*mermaid'],
 'keyboard keys': [r'\+\+[\w+-]+\+\+'],
 'card/grid HTML': [r'class=["\'][^"\']*\bcards?\b'],
 'numbered headings': [r'^#{2,6}\s+\d+[.)]\s+\S'],
}
CODEOK = {'mermaid diagrams', 'quick-start <script> meta'}
FENCE = re.compile(r'^\s*(```|~~~)')
def strip_code(lines):
    out, inf = [], False
    for ln in lines:
        if FENCE.match(ln): inf = not inf; out.append(''); continue
        out.append('' if inf else ln)
    return out
def pages():
    for sid, (mk, root, skip) in SECTIONS.items():
        base = os.path.join(SRC, root)
        for dp, dn, fn in os.walk(base):
            for f in fn:
                rel = os.path.relpath(os.path.join(dp, f), base)
                if f.endswith(('.md', '.mdx')) and not any(rel.startswith(s) for s in skip):
                    yield sid, root.split('@')[0], open(os.path.join(dp, f), encoding='utf-8', errors='replace').read().split('\n')
if MODE == 'tabs':
    tabs, adm = collections.Counter(), collections.Counter()
    for sid, repo, raw in pages():
        for l in strip_code(raw):
            m = re.match(r'^\s*===\+?\s+"([^"]*)"', l) or re.search(r'<TabItem\b[^>]*?label=["{]+([^"}]*)', l)
            if m: tabs[m.group(1).strip()] += 1
            m = re.match(r'^\s*(?:!!!|\?\?\?\+?|:::)\s*([\w-]+)', l)
            if m: adm[m.group(1).lower()] += 1
    print(tabs.most_common(80)); print(adm.most_common(40)); sys.exit()
rx = {k: re.compile('|'.join(f'(?:{p})' for p in v), re.I) for k, v in PAT.items()}
res = {k: [0, set(), set()] for k in PAT}; total = 0
for sid, repo, raw in pages():
    total += 1; stripped = strip_code(raw)
    for k, r in rx.items():
        if any(r.search(l) for l in (raw if k in CODEOK else stripped)):
            res[k][0] += 1; res[k][1].add(sid); res[k][2].add(repo)
print('pages', total)
for k, (n, s, r) in res.items(): print(f'| {k} | {n} | {len(s)} | {len(r)} |')
```

Spot checks used shell one-liners such as:

```sh
grep -rh '^template:' docs-site/.cache/sources/wso2__docs-is@c2176fcd1b50/en/asgardeo/docs | sort | uniq -c
grep -rl 'const meta' docs-site/.cache/sources/wso2__docs-is@c2176fcd1b50/en/{asgardeo,identity-server/7.3.0}/docs | wc -l
grep -oE 'content\.tabs\.link' docs-site/.cache/sources/wso2__docs-*/en/mkdocs.yml
```

## Caveats

- Regex counts, not parsed Markdown. Code-fence stripping ignores indented code blocks and `~~~` nested inside ``` fences. The permission and "any status word" counts are deliberately loose upper bounds. The prerequisite heading list includes "Requirements", which also matches a few non-prerequisite sections.
- Pages outside nav, `includes/` partials and lock-file `exclude:` pages are counted. Docusaurus sidebar membership was not checked.
- IS shared includes are counted once, though they render on both Asgardeo and IS 7.3.0. Page counts for IS and Asgardeo alone therefore understate what readers see.
- The API Platform `docs_root` folders and the Bijira `cloud/` companion share one snapshot. They are counted as separate buckets but one repo.
- Integrator connector pages and generated REST API pages inflate several counts (Step headings, `<details>`, "What you'll build", "required scopes"). Whether they are generated upstream was not verified.
- Tab-group detection covers MkDocs only. The Docusaurus `<Tabs>` figures are counts of labels and blocks.
- Older versions of each section were not counted. Patterns may differ there.
- No credentials or tokens were encountered.
