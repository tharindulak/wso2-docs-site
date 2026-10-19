# 01 How reference docs sites implement site features (researched 2026-10-12)

Answers [issue 01](../issues/01-site-features-research.md).

Scope: **site features** only (see [CONTEXT.md](../../../CONTEXT.md)). It builds on [research 17](../../wso2-docs-site/research/17-documentation-elements.md) section A. Search, landing pages, i18n, the older-version banner and the mobile menu are excluded.

**Method.** Each site was checked on 2026-10-12 in four ways:
- live HTML and HTTP responses (curl / WebFetch)
- public contributor and style guides
- open-source repos (`github/docs`, `gitlab-org/technical-writing/docs-gitlab-com`, `cloudflare/cloudflare-docs` at commit 0d35c2c, `hashicorp/dev-portal`, `hashicorp/web-unified-docs`, `MicrosoftDocs/*`)
- vendor product docs for MCP servers

Stripe and the Microsoft Learn platform are closed source, so their rows describe rendered behaviour only. **[unverified]** means a claim not confirmed in a primary source. All of this is planning input for review by the docs team. Nothing here is decided.

Site abbreviations used in the tables: GL = GitLab, GH = GitHub, HC = HashiCorp, MS = Microsoft Learn, ST = Stripe, CF = Cloudflare.

## TL;DR

- **Copying "view as Markdown" is cheap and safe.**
  - Five of the six sites serve each page as Markdown: a `.md` URL, an `Accept: text/markdown` request, or both. The exception is HashiCorp, which serves Markdown only through its internal content API.
  - Cloudflare and GitLab generate it at build time. GitHub and Stripe render it server-side at request time.
  - Two cautions:
    - GitLab ships its raw source, so shortcodes leak into the Markdown.
    - Microsoft's Markdown front matter exposes author, manager and reviewer aliases and private repo links.
- **`llms.txt`** is on GitHub, GitLab, Stripe and Cloudflare. Only Cloudflare serves `llms-full.txt`: 67.6 MB site-wide, from R2 object storage, plus one file per product. Microsoft and HashiCorp have none.
- **A last-updated date is rarer than research 17 implied.**
  - Only Cloudflare and Microsoft show one.
  - Cloudflare uses the **git author date**, overridable in front matter. It does *not* show its `reviewed` date; that field only sorts tutorial lists.
  - Microsoft shows a "calculated" date that matches neither `ms.date` nor the publish date. Its algorithm is undocumented.
- **Page feedback is never script-free.** There are three patterns:
  - first-party endpoint (GitHub to its Hydro data warehouse, Stripe, Microsoft)
  - first-party endpoint plus Turnstile bot challenge (Cloudflare)
  - browser writing directly to Google Firestore, with reCAPTCHA (GitLab)

  HashiCorp only links to a Microsoft Forms survey. Every free-text box collects possible PII.
- **The AI features split by vendor.**
  - In-page chat: Microsoft (Ask Learn, sign-in required), Stripe (Assistant) and GitHub (Copilot in search).
  - "Open in ChatGPT/Claude": **only GitLab**. It passes the page URL, not the content.
  - Docs MCP servers: Microsoft (hosted, no auth), Cloudflare (hosted, Apache-2.0 source) and Stripe (full API, needs a key). HashiCorp's MCP server queries the public Terraform Registry and can manage HCP Terraform workspaces, rather than searching the docs.
- **Analytics and consent shape every measured feature:**
  - GitLab loads GTM plus LinkedIn, Bizible and Marketo behind OneTrust.
  - HashiCorp loads Datadog RUM and Instana without waiting for consent.
  - GitHub is entirely first-party, but still records IP address and github.com username.
- **Research 17 got these wrong or out of date:**
  - Cloudflare now runs on Nimbus, not Starlight.
  - HashiCorp has no Yes/No feedback widget.
  - GitHub has no llms-full.txt.
  - Cloudflare does not show its reviewed date.
  - The ChatGPT/Claude menu exists on GitLab, not GitHub.

## Licences of the open implementations

| Repo | Code | Content | Note |
|---|---|---|---|
| github/docs | MIT (`LICENSE-CODE`) | CC BY 4.0 | Mirror of private `docs-internal` |
| gitlab-org/technical-writing/docs-gitlab-com | MIT | CC BY-SA 4.0 (content lives in `gitlab-org/gitlab/doc`) | Share-alike: do not copy prose |
| cloudflare/cloudflare-docs | MIT (`LICENSE-CODE`) | CC BY 4.0 | Theme `@cloudflare/nimbus-docs` is MIT |
| cloudflare/mcp-server-cloudflare | Apache-2.0 | | Docs MCP server (`apps/docs-ai-search`) |
| hashicorp/dev-portal | MPL-2.0 (file-level copyleft) | | Site front end |
| hashicorp/web-unified-docs | BUSL-1.1 (not open source) | BUSL-1.1 | Do not reuse without legal review |
| hashicorp/terraform-mcp-server | MPL-2.0 | | |
| MicrosoftDocs/azure-docs, MicrosoftDocs/mcp | MIT for code [unverified for azure-docs] | CC BY 4.0 | Platform and MCP server are closed |
| Stripe docs | closed | no open licence [unverified] | Markdoc (MIT) and `stripe/ai` (MIT) are open |

MPL-2.0 and BUSL-1.1 need OSS/legal review against WSO2's Apache-2.0 policy before any code reuse. The safest course is to implement features independently, using these repos only as references.

## 1. Page feedback

| Site | What the reader sees, where | Generated / data path | Data collected | Third parties | Source |
|---|---|---|---|---|---|
| GH | Footer "Was this Doc helpful?" Yes/No, then optional comment and **optional email** | Runtime. Browser POSTs to first-party `/api/events`. The server scores spam and sentiment locally (`cuss`, language guesser), then HMAC-signs and forwards to Hydro, GitHub's internal data warehouse | Vote, comment, email, plus the standard event context (see section 17) | None | `src/events/components/Survey.tsx`, `src/events/middleware.ts`, `src/events/lib/hydro.ts` |
| GL | Bottom of page, Yes/No, then reason dropdown and comment of up to 500 characters | Runtime, **browser writes directly to Google Firestore**, protected by Firebase App Check and reCAPTCHA v3. Rules reject emails and phone numbers. Synced to BigQuery; Workato posts comments to Slack every hour. Kill switch `feedback_enabled` | Vote, reason, comment, URL, language, owning `stage`/`group` taken from front matter | Google (Firebase, reCAPTCHA, BigQuery), Workato, Slack | `themes/gitlab-docs/src/components/feedback_form.vue`, `src/services/firestore.js`, `config/feedback/firestore.rules`, `doc/feedback.md` |
| HC | No per-page rating. "Give Feedback" in header and footer opens a **Microsoft Forms** survey | Plain link | Whatever the reader types into the form | Microsoft 365 | dev-portal `src/constants/feedback-form.ts` |
| MS | Right rail "Was this page helpful?" Yes/No. No opens "Ask Learn" or "Suggest a fix". Plus a "Feedback" button that links to Q&A, feedback.azure.com and GitHub | Runtime, Microsoft backend; per-page metadata `feedback_system`, `feedback_help_link_url`, `feedback_github_repo` | Not publicly documented [unverified] | Microsoft-owned only | Live HTML (closed source) |
| ST | Article footer "Was this page helpful?" | Runtime, first-party `/_endpoint/send-csat-feedback`; also `report-code-snippet` | Payload [unverified] | None seen | Live page state (`shell_features.csat`) |
| CF | Right rail (bottom of the content column on narrow screens) "Was this helpful?". Yes/No, then a required reason, free text and a Turnstile challenge. Turned off per page with `feedback: false` | Runtime. Multipart POST to `feedback.developers.cloudflare.com`, plus a Zaraz event (`zaraz.track`, Cloudflare's tag manager) carrying option and reason | Option, reason, free text, `location.pathname`, **`document.referrer`** | Turnstile (Cloudflare) through the `@marsidev/react-turnstile` npm wrapper | `src/components/react/FeedbackPrompt.tsx`, `src/layouts/DocsLayout.astro` |

Concerns:
- Any free-text field collects PII. GitLab rejects emails and phone numbers at the database. GitHub asks for an email on purpose.
- Sending `document.referrer` (Cloudflare) can leak internal URLs.
- GitLab's pattern sends the reader's IP address and device signals to Google.
- Every one of these needs a privacy notice and a retention policy.

## 2. Last-updated and last-reviewed date

| Site | Shown? | Where | Source of the date |
|---|---|---|---|
| CF | Yes: "Last updated Oct 1, 2026" | Under the H1 in the page-actions bar, hidden below 900 px; also in JSON-LD `dateModified` | **Build time**, `entry.data.lastUpdated ?? getLastUpdated(entry)` (`src/pages/[...slug].astro`). Nimbus runs `git log --format=t:%at`, which gives the **git author date** of the last commit touching the file. Front matter `lastUpdated` overrides it. Nimbus warns that shallow clones return nothing. The sitemap `lastmod` uses the committer date (`%cI`) |
| CF `reviewed` | **Not shown** | | Front matter `YYYY-MM-DD` ("last explicitly reviewed from beginning to end", style guide). Used only to sort `ListTutorials` and passed into page meta |
| MS | Yes: "Last updated on <date>" in the footer, shown in the reader's local time | Article footer | Rendered client-side with `data-article-date-source="calculated"`. On the sampled page, `ms.date` (front matter, "substantially edited or guaranteed fresh") was 2025-03-27, the publish date was 2026-08-03 and the displayed date was 2025-12-01. The algorithm is undocumented [unverified]. `ms.update-cycle: 1095-days` drives review cycles |
| GH | No (except `effectiveDate` on legal pages, which also sets the HTTP `Last-Modified` header) | | Front matter only |
| GL | No | | Hugo `enableGitInfo` is off. Expiry markers (`remove_date`) are checked by a build task and not shown |
| HC | No on docs pages (yes on integration pages) | | The content API returns `last_modified` from front matter or a generated file, but the UI does not show it |
| ST | No | | |

Implication for us: using git author date with a front matter override (the Cloudflare pattern) matches the "pinned source commit per file" note in research 17. The fetch step must keep enough history for `git log` to work.

## 3. Copy and view as Markdown

| Site | Reader UI | Endpoint | Generated |
|---|---|---|---|
| GH | Below the intro: "Copy markdown" and a menu with "View as Markdown" and "Ask Copilot" | `<page>.md`, `Accept: text/markdown`, `/api/article/body` | **Runtime**, server-rendered. Liquid and autogenerated pages (REST, GraphQL) are turned into clean Markdown by `src/article-api/transformers/*`. Copy and click events go to Hydro |
| GL | "Copy for LLM" split button: Copy as Markdown, View Markdown, Open in Claude, Open in ChatGPT | `<page>/index.md` | **Build time**, a Hugo output format (`layouts/_default/single.markdown` = title plus `.RawContent`). **Raw shortcodes leak** into it |
| CF | Under the H1: Copy as Markdown, View as Markdown, Agent setup | `<page>/index.md`, `Accept: text/markdown`, `<link rel="alternate" type="text/markdown">` | Build time, plus a Worker (`worker/index.ts`, `worker/markdown-404.ts`) for content negotiation and Markdown 404s. Each page also carries a hidden pointer to `llms.txt` |
| ST | Action bar: Ask about this page, Copy for LLM, View as Markdown, Install tools | `<page>.md` (pages with variants return an index of variant URLs), `Accept: text/markdown` | Runtime [unverified mechanism], documented at `docs.stripe.com/agents.md` |
| MS | "Copy Markdown" in the ⋮ "More actions" menu | `?accept=text/markdown` or the Accept header. No `.md` URL | Runtime. The YAML front matter **exposes `ms.author`, `manager`, `ms.reviewer` and links to private `-pr` repos** |
| HC | None for readers | Internal content API `?mdOnly=true` (raw MDX, `noindex`) | |

Data and third parties: none, except GitHub's click analytics. Do not copy the Microsoft pattern of exposing metadata.

## 4. llms.txt and llms-full.txt

| Site | llms.txt | llms-full.txt | How it is built |
|---|---|---|---|
| GH | Yes, 28 KB; points agents to the Article, Pagelist and Search APIs | No (404) | Weekly workflow `sync-llms-txt.yml` builds it from the page catalogue plus popularity data into `data/llms-txt/docs.md` |
| GL | Yes, 87 KB | No | CI on every build, from `navigation.yaml`, by `cmd/internal/build/build_llms_txt.go`. Excludes the API and CLI pages |
| CF | Yes, site-wide and per product (`/workers/llms.txt`) | Yes: 67.6 MB site-wide, ~5 MB per product, served from R2 | Static build (`src/util/llms-txt.ts`). Also `/.well-known/ai-catalog.json`, `/.well-known/api-catalog` (RFC 9727) and `/.well-known/agent-skills/index.json` |
| ST | Yes, 92 KB, with a preamble for LLMs (check latest versions, use sandboxes); footer "LLM? Read llms.txt" | No | Closed. Also `/.well-known/skills/index.json` |
| MS | No (404) | No | Uses Markdown negotiation and the MCP server instead |
| HC | No | No | |

## 5. Changelog and release notes, with RSS

| Site | What exists | RSS | Generated |
|---|---|---|---|
| CF | `/changelog/`, filtered by product and area | Yes: `/changelog/rss/index.xml` (~8 MB), one per product or area, plus a Markdown variant (`index.md.xml`) | Build time, from changelog entries (`src/util/rss.ts`, `RSSButton.astro`) |
| GL | `/releases/` hub built from release-post data | Yes, four feeds (releases, all, patch, breaking changes) | Hugo output formats (`layouts/_default/*-rss.xml`) |
| GH | Product changelog lives on github.blog (RSS there). The docs hold GraphQL changelog, GHES release notes, REST changelog, and a "What's new" link on landing pages | Only on the blog | Build scripts from JSON data (`src/graphql/scripts/build-changelog.ts`) |
| ST | Versioned `/changelog` (per API version) | None found [unverified absence] | Closed |
| MS | Per-service "What's new" articles [unverified per service]; Azure Updates outside Learn | Yes, Azure Updates RSS on microsoft.com | Closed |
| HC | HCP changelog docs page; TFE releases page; CLI changelog on GitHub | None found | Authored MDX |

No data collected and no third parties, apart from the hosting.

## 6. Support and status links

| Site | Support | Status |
|---|---|---|
| GH | Footer "Still need help?": community discussions (front matter `communityRedirect` overrides the link) and Contact support (`Support.tsx`). Also an embedded support virtual-agent iframe (`SupportPortalVaIframe.tsx`) | Footer "Status" |
| GL | Footer Help: Support, Forum (`docs-feedback` tag) | Not confirmed [unverified] |
| CF | Footer Support, Community; JSON-LD `contactPoint`; per-page "Report issue" opens a GitHub issue | Footer Status (cloudflarestatus.com); also in `/.well-known/api-catalog` |
| HC | Footer Support (IBM support site) | Footer System Status (Atlassian Statuspage). API pages show a live **`ServiceStatusBadge`** that reads the Statuspage API at runtime |
| MS | Q&A link in the feedback popover | Linked from article bodies only |
| ST | Footer "Need help?", support.stripe.com; Discord link behind a flag | Not on the sampled page |

The HashiCorp status badge is a runtime call to Atlassian Statuspage, which brings a third-party request.

## 7. Console deep links

| Site | Mechanism | Validation |
|---|---|---|
| CF | `DashButton.astro`: "Go to <name> ↗" to `dash.cloudflare.com` / `one.dash.cloudflare.com` | **The build fails** if the route is not in `src/content/dash-routes/*.json` |
| MS | Authored "Deploy to Azure" buttons (`portal.azure.com/#create/Microsoft.Template/uri/<template>`) | None |
| HC | Header "Sign up" / "Try HCP Terraform" to `portal.cloud.hashicorp.com`; MDX `HcpCallout` component | None |
| ST | Inline `dashboard.stripe.com` links; login redirects back to the docs page | [unverified] |
| GH | Header "Sign up" (logged-in check uses the `is_logged_in` cookie); "Ask Copilot" deep link | None |
| GL | Edit menu: Web IDE, View source, Suggest updates (opens an issue from a template); footer free trial | None |

The Cloudflare pattern is the one worth copying: a build-time allow-list of console routes, so broken deep links fail CI. It needs no data and no third party.

## 8. API try-it and request samples

| Site | Samples | Try-it |
|---|---|---|
| GH | curl, `gh api` and Octokit.js generated per endpoint from the OpenAPI spec (`get-rest-code-samples.ts`); token placeholder `YOUR-TOKEN`; example response and schema toggle | No |
| CF | `APIRequest.astro` builds curl at **build time** from the pinned `openapi.lock.json`; the build fails on an invalid path, parameter or token group. `/api/` reference (separate Starlight build, Stainless style [inferred]) has an SDK language selector | Not found [unverified absence] |
| MS | Static "Sample request" tabs (HTTP, Java, Python, Go, JS) and responses | **Yes**: `enable_rest_try_it` meta tag; client-side panel uses Entra ID OAuth (`user_impersonation`) and makes **real calls against the reader's subscription** [UI flow unverified] |
| ST | Multi-language samples pinned to an API version; links to Workbench in the Dashboard | In-docs console [unverified] |
| HC | Hand-written curl and sample responses | No |
| GL | Hand-written curl in Markdown | No |

Microsoft's try-it, which signs the reader in and calls a real management API from the docs page, is the only full implementation found. It needs OAuth, CORS and a security design, which supports research 17's P3 rating.

## 9. Personalised samples

| Site | What |
|---|---|
| ST | **Yes.** Markdoc `ApiKey` tags are filled at runtime. Logged out they show placeholder `pk_test_…`. Logged in they show the reader's own test keys and data ("Log in to see docs with your test key and data"). Anonymous visitors can be given a sandbox, gated by **hCaptcha** [details unverified] |
| GL | Reader-editable placeholders (`code-editable` shortcode). Values are kept in `sessionStorage` per page and copied with the code. No account data |
| GH | OS and tool pickers saved as preferences and sent as `preference` events. No account data |
| CF, HC, MS | No |

Concerns:
- Stripe puts real test keys into the DOM. Whether "Copy for LLM" strips them is [unverified]; this is a key-leak risk.
- hCaptcha is a third-party processor.

## 10. AI chat

| Site | UI | Backend / data |
|---|---|---|
| MS | "Ask Learn" in the header (flyout on desktop), sign-in required. Also in the feedback "No" popover. Plus "Summarize this article for me" | Same knowledge service as Copilot for Azure. 500-character prompts, grounded only on Learn content, thumbs feedback. Retention not documented [unverified] (Ask Learn transparency FAQ) |
| ST | Header "Ask AI" opens the Stripe Assistant side panel; "Ask about this page" | `ai.stripe.com`, suggested questions, feedback endpoints. No public retention statement [unverified] |
| GH | "Search or ask Copilot" inside search | Server proxies to an internal Copilot answers service (`ai-search-proxy.ts`). UI says "GitHub will retain questions and answers". Events go to Hydro |
| CF | No chat. Search uses Cloudflare AI Search (`@cloudflare/ai-search-snippet` 0.0.43, MIT) | Queries go to `ai-search.developers.cloudflare.com` |
| GL, HC | No | |

Every chat sends reader prompts to the vendor. Only GitHub states retention on the page.

## 11. Open in ChatGPT or Claude

| Site | What |
|---|---|
| GL | **Yes**, in the "Copy for LLM" menu: `claude.ai/new?q=` and `chatgpt.com?q=` with "Read from <page>/index.md and answer my follow-up questions". Only a public URL is passed (`copy_for_llm.vue`) |
| GH | "Ask Copilot" only (`github.com/copilot?prompt=…<page>.md`) |
| CF | No; offers an "Agent setup" page listing its MCP servers instead |
| ST | No; offers "Install tools" (menu contents [unverified]) |
| HC, MS | No |

The site sends nothing itself, but the reader then becomes subject to the AI provider's terms. Linking to third-party AI brands may need brand and legal review.

## 12. Docs MCP server

| Site | Endpoint | Auth | Tools | Source / licence |
|---|---|---|---|---|
| MS | `https://learn.microsoft.com/api/mcp` (streamable HTTP) | None, free; Learn Terms of Use | `microsoft_docs_search`, `microsoft_docs_fetch`, `microsoft_code_sample_search` | Server closed; `MicrosoftDocs/mcp` (plugins, CLI) is CC BY 4.0 for docs and MIT for code |
| CF | `https://docs.mcp.cloudflare.com/mcp` (the SSE endpoint is retired). Also **WebMCP**: `navigator.modelContext` tools `search` and `list-directories` registered on the page (`src/scripts/webmcp.ts`) | None | Docs search over AI Search | `cloudflare/mcp-server-cloudflare/apps/docs-ai-search`, Apache-2.0 |
| ST | `https://mcp.stripe.com` | OAuth or agent API key; from 2026-10-31 rejects full-access secret keys | Docs search plus **read/write API tools** | Closed; `stripe/ai` MIT |
| HC | Self-hosted `terraform-mcp-server` (Docker, Go binary, Helm) | `TFE_TOKEN` for HCP/TFE write tools | Public Registry lookups and workspace management | MPL-2.0. The README warns against use with untrusted clients |
| GH, GL | None for the docs site. llms.txt says the GitHub MCP server "does not currently include docs search". GitLab has a *product* MCP server | | | |

A read-only, unauthenticated docs search server (the Microsoft or Cloudflare model) is the low-risk variant. Stripe and HashiCorp combine docs with write access to the product, which needs a security review.

## 13. Tutorials hub

| Site | What | Data |
|---|---|---|
| HC | Tutorial Library with filters, duration badges, collections and Prev/Next. **Instruqt** embedded labs. Progress and bookmarks need sign-in via HCP (next-auth) | Progress tied to an account; Instruqt is a third party |
| MS | Training modules and learning paths with XP, achievements and "Add to Collections/Plans"; sign-in required | Account-linked |
| GH | "Journeys" learning tracks: front matter `journeyTracks`, "Step i of n" and "Up next" in the mini TOC | None beyond analytics |
| CF | Per-product tutorial lists (`ListTutorials.astro`) built from `pcx_content_type: tutorial`, showing difficulty, sorted by `reviewed` | None |
| GL | `/tutorials/` authored page | None |
| ST | `/quickstarts`; a single hub [unverified] | |

A build-time list from front matter (the Cloudflare and GitHub pattern) needs no data. Progress tracking needs accounts.

## 14. PDF

- **No site offers it for certain.**
  - Microsoft pages carry a `pdf_url_template` meta tag (pointing to `pdfstore`). Whether a "Download PDF" link is rendered is [unverified], and the sampled page had none.
  - GitLab has a print stylesheet.
  - GitHub tracks a `print` event.
- Research 17's claim that Microsoft Learn offers downloadable PDFs is unconfirmed. AWS was not in scope here.

## 15. Related content and next steps

| Site | What | Generated |
|---|---|---|
| MS | Right rail "Additional resources": training, certification and events cards | **Runtime recommendations** (`recommendations: true`, `recommendation_types`); plus authored "Next steps" |
| GH | Journey "Up next"; **link hovercards** (`LinkPreviewPopover.tsx` fetches `/api/article/meta` at runtime) | Runtime, first-party |
| CF | Prev/next pagination; `RelatedProduct` cards; front matter `products` | Build time / authored |
| HC | Tutorial Prev/Next | Build time |
| ST | "See also" block | Authored |
| GL | Authored "Related topics" | Authored |

## 16. Glossary tooltips

| Site | Tooltip | Glossary page |
|---|---|---|
| CF | `GlossaryTooltip.astro`: dashed underline, focusable; the definition is rendered into `data-content` at build time from `src/content/glossary/*`, shown with Tippy.js. The **build fails on an unknown term** | `/glossary/` |
| GL | `glossary-tooltip` shortcode from `data/<lang>/glossary-tooltips/glossary.yaml`, enhanced in Vue; links to the glossary anchor | Terminology pages |
| ST | Markdoc `{% glossary %}` tag renders a link; tooltip [unverified] | `/glossary` |
| GH | No tooltip | Generated from `data/glossaries/external.yml` |
| HC | No | `/terraform/docs/glossary` |
| MS | No | |

## 17. Analytics and consent (context for every measured feature)

| Site | Consent | Analytics | Notes |
|---|---|---|---|
| GH | None (no third-party scripts) | First-party `/api/events` forwarded to Hydro | Records a random user ID, href, referrer, viewport, timezone and language. **The server adds the client IP, the github.com username cookie, `is_staff` and the `_octo` ID.** First-party collection still carries GDPR duties |
| GL | OneTrust | GTM, GA, Bizible, Marketo Munchkin, LinkedIn Insight; Marketo email form on install pages | Turned off outside production (`ANALYTICS_ENABLED`) |
| HC | DataGrail | GTM and **PostHog (EU)** only after consent. **Datadog RUM and Instana EUM load unconditionally** (`core-dev-dot-layout`) | The consent gap needs legal review. The tracking spec is public (`analytics/spec/events/*.yaml`) |
| MS | Microsoft WCP consent | 1DS/JSLL (`js.monitor.azure.com`); `clicktale: true` on some pages suggests session replay [unverified] | Microsoft-owned only |
| CF | OneTrust (no SRI) | Zaraz events (`src/util/zaraz.ts`); how the loader is injected and whether it waits for consent is [unverified] | No GA found |
| ST | Own `CookieBanner` (vendor [unverified]) | First-party; Sentry on `errors.stripe.com` | All scripts from `b.stripecdn.com` under a CSP nonce |

## Features research 17 missed

Site features (not content components) seen on at least one reference site, absent from research 17 section A:

1. **Markdown content negotiation and Markdown 404s.** `Accept: text/markdown` on the HTML URL (GitHub, Cloudflare, Stripe, Microsoft). A Markdown 404 page (Cloudflare `worker/markdown-404.ts`).
2. **Agent discovery files.**
   - `/.well-known/ai-catalog.json`, `/.well-known/api-catalog` (RFC 9727) and `/.well-known/agent-skills/index.json` (Cloudflare).
   - `/.well-known/skills/index.json` (Stripe).
   - A hidden "llms.txt directive" on each page (Cloudflare).
3. **"Agent setup" page** listing MCP servers and tools (Cloudflare `/agent-setup/`), and Stripe's "Install tools" button.
4. **WebMCP**: page-registered `navigator.modelContext` tools (Cloudflare; Stripe flag [unverified]).
5. **Content Signals in robots.txt**: stating AI training, search and input policy (Cloudflare, Stripe `ai-train=yes`). This is a business and legal decision for WSO2.
6. **AI article summary**: "Summarize this article for me" (Microsoft).
7. **Link hovercards** showing the target page's title and intro (GitHub).
8. **Live service status badge** on API pages (HashiCorp, via the Statuspage API).
9. **Contributors page** built from GitHub contributor data (Cloudflare `/contributors/`).
10. **Generated Open Graph images** per page (Cloudflare `worker/og/`).
11. **Structured data (JSON-LD)**: breadcrumb, article `dateModified` and `contactPoint` (GitLab, Cloudflare).
12. **"Report issue" / "Suggest updates"** opening a templated GitHub or GitLab issue, alongside edit-this-page (Cloudflare, GitLab).
13. **Reading mode, Print, and Add to Collections/Plans** in a page overflow menu (Microsoft; collections need sign-in).
14. **Keyboard shortcuts** (GitLab: `/` for search, `.` for Web IDE).
15. **Anonymous sandbox provisioning** from the docs (Stripe, hCaptcha) [unverified details].
16. **Questionnaire walkthroughs** recommending a path (GitLab experiment).
17. **Build-time link validation for product-specific references** (Cloudflare fails the build on unknown dashboard routes, API paths or glossary terms). This is a cross-cutting pattern, not a reader-visible feature, but it lowers the upkeep cost of features 7, 8 and 16.
18. **Analytics and consent** as a site feature in its own right (section 17). Research 17 did not list it, though the map already has it as fog.

Corrections to research 17:
- **A2 (page feedback).** HashiCorp has only a Microsoft Forms link, not Yes/No.
- **A3 (last updated).** Cloudflare shows the last-updated date but not the last-reviewed date.
- **A5 (llms.txt).** GitHub has no llms-full.txt.
- **A17 (Open in ChatGPT/Claude).** GitLab, not GitHub, has the menu.
- **A21 (PDF).** The Microsoft Learn PDF is unconfirmed.
- **Cloudflare's stack** is now Nimbus (Astro, MIT), not Starlight; only `/api/` remains on Starlight.

## Sources

**GitHub**
- https://github.com/github/docs: `src/events/*`, `src/frame/components/article/ViewMarkdownButton.tsx`, `src/article-api/*`, `src/frame/middleware/llms-txt.ts`, `.github/workflows/sync-llms-txt.yml`, `src/rest/components/get-rest-code-samples.ts`, `src/search/lib/ai-search-proxy.ts`, `src/links/components/LinkPreviewPopover.tsx`, `src/journeys/*`, `data/ui.yml`
- https://docs.github.com/llms.txt

**GitLab**
- https://gitlab.com/gitlab-org/technical-writing/docs-gitlab-com: `doc/feedback.md`, `doc/llms-txt.md`, `doc/analytics.md`, `doc/experiments.md`, `config/_default/hugo.yaml`, `config/feedback/firestore.rules`, `themes/gitlab-docs/src/components/{feedback_form,copy_for_llm,glossary_tooltip}.vue`, `cmd/internal/build/build_llms_txt.go`
- https://gitlab.com/gitlab-org/gitlab/-/raw/master/LICENSE
- https://docs.gitlab.com/llms.txt and https://docs.gitlab.com/releases/releases.xml

**Cloudflare**
- https://github.com/cloudflare/cloudflare-docs @ 0d35c2c: `src/components/react/FeedbackPrompt.tsx`, `src/pages/[...slug].astro`, `src/components/ui/page-actions/*`, `worker/index.ts`, `worker/markdown-404.ts`, `src/util/llms-txt.ts`, `src/util/rss.ts`, `src/components/cf/{DashButton,APIRequest,GlossaryTooltip,ListTutorials}.astro`, `src/scripts/webmcp.ts`, `src/components/OneTrust.astro`, `src/util/zaraz.ts`
- npm `@cloudflare/nimbus-docs@0.15.0`
- https://developers.cloudflare.com/style-guide/build-the-page/frontmatter/custom-properties/
- https://github.com/cloudflare/mcp-server-cloudflare

**HashiCorp**
- https://github.com/hashicorp/dev-portal: `src/constants/feedback-form.ts`, `src/components/service-status-badge/`, `src/components/lab-embed/`, `src/lib/learn-client/api/progress/`, `src/lib/consent-manager/`, `src/components/posthog/posthog-provider.tsx`, `src/layouts/core-dev-dot-layout/index.tsx`, `analytics/`
- https://github.com/hashicorp/web-unified-docs (LICENSE BUSL-1.1)
- https://github.com/hashicorp/terraform-mcp-server
- https://developer.hashicorp.com/terraform/mcp-server

**Microsoft Learn**
- Live page https://learn.microsoft.com/en-us/azure/virtual-machines/overview
- https://learn.microsoft.com/en-us/contribute/content/metadata
- https://learn.microsoft.com/en-us/azure/azure-resource-manager/templates/deploy-to-azure-button
- https://learn.microsoft.com/en-us/rest/api/compute/virtual-machines/get
- https://learn.microsoft.com/training/support/ask-learn-assistant-transparency-faq
- https://learn.microsoft.com/en-us/training/support/mcp
- https://github.com/MicrosoftDocs/mcp

**Stripe**
- Live pages https://docs.stripe.com/payments/accept-a-payment, https://docs.stripe.com/api, https://docs.stripe.com/changelog
- https://docs.stripe.com/agents.md, https://docs.stripe.com/mcp.md, https://docs.stripe.com/llms.txt, https://docs.stripe.com/robots.txt
