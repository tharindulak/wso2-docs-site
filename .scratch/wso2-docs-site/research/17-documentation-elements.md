# 17 Documentation elements to consider for the WSO2 docs site (researched 2026-10-09)

Not tied to a map ticket: a one-off gap analysis requested outside the map. Inputs: an audit of `docs-site/` and this map, plus reading of GitLab, GitHub, HashiCorp, AWS, Microsoft Learn (Azure), Stripe, Cloudflare and Google Cloud docs and their public contributor guides.

**[unverified]** marks items seen only in search snippets or page markup, not confirmed rendered. Everything here is planning input for review by the docs team; nothing is decided.

Priority key (suggestion only): **P1** high value, low cost, fits the WSO2Con skeleton; **P2** next cycle; **P3** later or needs a product decision.

## TL;DR

- We already match the leaders on the hard structural pieces: HashiCorp-style product navigation, GitLab-style deployment-option box, version selector, edit-this-page, Redoc API reference, labelled cloud/self-hosted blocks, tabs, includes and conditionals.
- The biggest gaps every reference site has and we don't: **search** (known), **page feedback**, **last updated date**, **feature lifecycle badges** (Beta/GA/Deprecated), **feature history** ("Introduced in Identity Server 7.1"), **prerequisites/required roles** pattern, and **AI-readable outputs** (llms.txt, copy page as Markdown).
- On the authoring side, the gap is less components than a **content model**: named topic types with templates (concept, task, reference, troubleshooting, tutorial, quickstart), which GitLab, GitHub, HashiCorp, Microsoft and Cloudflare all publish.

## A. Site and page UI elements

| # | Element | Seen on | WSO2 site today | Priority |
|---|---|---|---|---|
| A1 | Product-scoped search, with "this product" filter | All; GitHub adds Ask Copilot in search | Placeholder; choice and legal review open (issues 11, 12) | P1 (in flight) |
| A2 | "Was this page helpful?" Yes/No + optional comment | GitLab, GitHub, AWS, Microsoft Learn, HashiCorp, Google Cloud | Absent, not planned | P1 |
| A3 | Last updated date (from git), optional "last reviewed" date | Cloudflare (both), Google Cloud | Absent; fetch loses git history, so take the date from the pinned source commit per file | P1 |
| A4 | Copy page as Markdown / View as Markdown / `.md` URL per page | GitHub, Stripe, Cloudflare, Mintlify sites, GitLab (`index.md`) | Absent | P1 |
| A5 | `llms.txt` (+ `llms-full.txt`) per product and site-wide | GitHub, GitLab, Stripe, Cloudflare | Absent | P1 |
| A6 | Older-version banner ("You are viewing 7.1; see Latest") | GitLab, HashiCorp ("Currently viewing … (latest)") | Planned (issue 08), absent | P1 |
| A7 | Breadcrumbs that include product and section | GitLab, GitHub, AWS | Stock Docusaurus; check product name appears | P1 (check) |
| A8 | Product overview / landing page with cards, featured links, learning paths | GitHub (`journey-landing`), GitLab (`cards`), HashiCorp, Microsoft Learn | Planned (issue 10); product name opens section landing | P1 |
| A9 | Mobile access to Products menu and Account links | All | Hidden under 996 px | P1 |
| A10 | Release notes / changelog per product, with RSS | Cloudflare (`ProductChangelog`, RSS), AWS (document history + RSS), GitHub (changelog on landing pages) | Absent | P2 |
| A11 | Status page and support links in footer / page end ("Still need help? Contact support") | GitHub, Microsoft Learn (Q&A link), AWS (re:Post) | Footer is copyright only | P2 |
| A12 | Console deep link button ("Open in WSO2 Cloud Console") | Cloudflare `DashButton` | Absent | P2 |
| A13 | Interactive API try-it console | Google APIs Explorer; GitHub shows code samples per endpoint | Redoc read-only | P3 (needs auth/CORS and security design) |
| A14 | Generated request samples per endpoint (cURL, JS, CLI) with required permissions/scopes | GitHub REST, Cloudflare `APIRequest` | Redoc shows samples only if the spec has them | P2 |
| A15 | Personalized samples (reader's org name, region, client ID filled in when signed in) | Stripe | Absent; needs WSO2 Cloud account integration | P3 |
| A16 | AI assistant on the page ("Ask" chat with cited sources) | Microsoft Learn (Ask Learn), AWS (Amazon Q), GitHub (Copilot) | Absent; existing Agent Manager site has Algolia Ask AI | P3 |
| A17 | "Open in ChatGPT / Claude" page menu | Mintlify sites, GitHub (Ask Copilot) | Absent | P3 |
| A18 | Docs MCP server (search docs from an IDE/agent) | Stripe, Cloudflare | Absent; Algolia DocSearch auto-enrols in DocSearchMCP (issue 03) | P3 |
| A19 | Tutorials hub with tracks, read time, progress | HashiCorp, Microsoft Learn | Absent | P3 |
| A20 | Hands-on labs / sandbox | HashiCorp (Instruqt). Microsoft retired its sandboxes | Absent | P3 (cost) |
| A21 | Downloadable PDF of a guide | AWS, Microsoft Learn | Absent | P3 |
| A22 | Localized versions | GitLab (ja-jp), GitHub, AWS, Microsoft Learn | Not yet specified on the map | P3 |
| A23 | Related content cards / "Next steps" button / "Additional resources" rail | Cloudflare, Microsoft Learn | Stock prev/next only | P2 |
| A24 | Glossary page + hover tooltips | GitLab, Cloudflare, GitHub (glossary page) | Absent; CONTEXT.md already holds the terms | P2 |

## B. Authoring and content elements

| # | Element | Seen on | WSO2 site today | Priority |
|---|---|---|---|---|
| B1 | **Topic types with templates**: Concept, Task/How-to, Reference, Troubleshooting, Tutorial, Get started/Quickstart, Release notes, FAQ | GitLab (CTRT), GitHub, HashiCorp (Diátaxis, `.mdx` templates), Microsoft (`ms.topic`), Cloudflare (`pcx_content_type`, required) | Absent; MkDocs pages carry no type | P1 (writing guidance + optional `content_type` front matter) |
| B2 | **Feature lifecycle badge**: Beta / Preview / GA / Deprecated, page or section level | GitLab (status in availability box), Google Cloud launch stages, Cloudflare `Badge` | Absent | P1 |
| B3 | **Availability details extended**: plan or tier (Free / paid / Enterprise) alongside deployment option | GitLab ("Tier / Offering"), Cloudflare `Plan`, HashiCorp `EnterpriseAlert` | Deployment-options box exists; plan/tier not covered | P2 (needs a product decision on WSO2 Cloud plans) |
| B4 | **Feature history block** ("Introduced in Identity Server 7.1", "Enabled on WSO2 Cloud 2026-08") | GitLab `history` | Absent | P2 |
| B5 | **Prerequisites / Required roles** section, fixed wording ("You must have:") | GitLab, GitHub (permissions front matter), Google Cloud ("Before you begin", "Required roles"), Microsoft | Ad hoc per product | P1 (template + optional front matter `permissions:`) |
| B6 | **Clean up / Next steps / Related topics** closing sections | Google Cloud, Microsoft, GitHub ("Next steps", "Further reading"), GitLab ("Related topics") | Ad hoc | P1 (template) |
| B7 | **Deprecation and removal notices** with dates and replacement, plus a central Deprecations page | GitLab, Google Cloud (12-month notice) | Absent | P2 |
| B8 | **Steps component** (numbered procedure with styling) | Cloudflare `Steps`, GitLab `guide` [unverified] | Plain ordered lists | P2 |
| B9 | **Synced tabs** across the page and site (Console / CLI / API; language; OS) | GitHub tool & platform switchers, Microsoft tabs + zone pivots, AWS console/CLI/SDK tabs | Tabs built, not synced (no `groupId`) | P1 (small converter change) |
| B10 | **Tool switcher defaults** set per page (`defaultTool`) | GitHub | Absent | P3 |
| B11 | **Alerts set**: note, tip, important, warning, caution, plus "flag" (feature flag) and "disclaimer" | GitHub, GitLab, Microsoft | 28 Material types mapped onto 5; no flag or disclaimer type | P2 |
| B12 | **Reusables and variables** (product names, versions) | GitHub (`data/reusables`, `data/variables`), HashiCorp partials, Microsoft `INCLUDE` | Built (includes, `{{ var }}`) | Done |
| B13 | **Version / product conditionals** | GitHub `ifversion`, HashiCorp `BEGIN: Vault:>=v1.21.x`, Microsoft monikers | Built (Jinja subset, numeric compare) | Done |
| B14 | **Image conventions**: themed (light/dark) images, lightbox, size limits, alt text rules, version in filename | GitLab, GitHub, Microsoft `:::image` | Images built; `attr_list` widths dropped; no lightbox; `ThemedImage` unused | P2 |
| B15 | **Code block extras**: line numbers, annotations, copy, file tree, package-manager tabs | GitHub `annotate`, Cloudflare `FileTree`, `PackageManagers` | Copy/title/highlight built; `linenums` dropped | P2 |
| B16 | **Config in two formats** (e.g. `deployment.toml` vs Console steps, or YAML/JSON) | Cloudflare `WranglerConfig` | Absent; relevant to Identity Server and APIM TOML | P3 |
| B17 | **Limits / quotas and regions tables** in a fixed schema (Name, Default, Adjustable) | AWS, Google Cloud | Absent; belongs to hub cross-cutting topics | P2 |
| B18 | **Front matter standard**: required `title`, `description` (length bounded), `content_type`, `products`, owner, `reviewed` | Microsoft, HashiCorp, Cloudflare | `title`, `description`, `keywords`, `tags` kept | P1 (define the set) |
| B19 | **UI text and word list**: bold UI labels, placeholder format, `<kbd>`, product-name rules | GitLab word list, GitHub, Microsoft, HashiCorp | CONTEXT.md covers names only | P2 |
| B20 | **Agent-facing instructions** in llms.txt or Markdown output ("use the latest SDK", "prefer X over Y") | Stripe, Cloudflare `CopyPrompt` | Absent | P3 |
| B21 | **Lint in content repos**: Vale, markdownlint, link checks | GitLab (Vale, markdownlint, Danger) | `wso2-docs check` covers syntax only | P2 |
| B22 | **Quick-start metadata rendered** (difficulty, time, effort) | Stripe ("Integration effort"), HashiCorp (`readTime`), Cloudflare (`difficulty`) | `quick_start` front matter parsed, never rendered | P2 |

## C. Risks and review points

- **Page feedback (A2):** storing comments or optional email is personal data. Needs a privacy review, a retention rule and spam protection. A plain Yes/No without free text or email is the low-risk start.
- **Analytics and AI chat (A16, A17):** third-party scripts and data sharing need legal/privacy approval and consent handling, as with the DocSearch review (issue 12).
- **Third-party Docusaurus plugins for llms.txt** (e.g. `docusaurus-plugin-llms`, `@signalwire/docusaurus-plugin-llms-txt`): check license, maintenance and supply chain before adopting. Generating llms.txt in `@wso2/docs-converter` (which already knows nav and pages) may be simpler and avoids a dependency.
- **Try-it console and personalized samples (A13, A15):** handle real credentials in the browser. Needs a security design (token scope, CORS, no persistence) before any work.
- **Copying from Cloudflare's open-source components:** confirm license and attribution [unverified: assumed MIT/CC-BY].

## D. Stale records found during the audit

- README "Known limits" still says `redoc` API pages are not rendered; commit 148294f added `ApiReference`.
- The map's "Not yet specified" still lists API reference rendering.

## Sources

- GitLab: https://docs.gitlab.com/development/documentation/styleguide/availability_details/ , https://docs.gitlab.com/development/documentation/topic_types/ , https://docs.gitlab.com/development/documentation/styleguide/deprecations_and_removals/ , https://docs.gitlab.com/development/documentation/feature_flags/ , https://docs.gitlab.com/llms.txt
- GitHub: https://docs.github.com/en/contributing/style-guide-and-content-model/about-the-content-model , https://docs.github.com/en/contributing/style-guide-and-content-model/contents-of-a-github-docs-article , https://docs.github.com/en/contributing/writing-for-github-docs/using-yaml-frontmatter , https://docs.github.com/en/contributing/writing-for-github-docs/versioning-documentation , https://docs.github.com/en/rest/repos/repos
- HashiCorp: https://developer.hashicorp.com/terraform/docs , https://github.com/hashicorp/web-unified-docs/blob/main/docs/content-guide/content-types.md , https://github.com/hashicorp/web-unified-docs/blob/main/docs/style-guide/general/enterprise-releases.md
- Microsoft Learn: https://learn.microsoft.com/en-us/contribute/content/markdown-reference , https://learn.microsoft.com/en-us/contribute/content/metadata , https://learn.microsoft.com/en-us/training/support/faq
- AWS: https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html , https://docs.aws.amazon.com/AmazonS3/latest/userguide/WhatsNew.html , https://docs.aws.amazon.com/code-library/latest/ug/what-is-code-library.html , https://docs.aws.amazon.com/general/latest/gr/s3.html
- Stripe: https://docs.stripe.com/building-with-ai , https://docs.stripe.com/payments/accept-a-payment , https://docs.stripe.com/mcp
- Cloudflare: https://developers.cloudflare.com/style-guide/build-the-page/components/ , https://developers.cloudflare.com/style-guide/documentation-content-strategy/content-types/ , https://developers.cloudflare.com/style-guide/documentation-content-strategy/component-attributes/last-updated/
- Google Cloud: https://cloud.google.com/terms/launch-stages , https://developers.google.com/explorer-help
- llms.txt: https://llmstxt.org/
