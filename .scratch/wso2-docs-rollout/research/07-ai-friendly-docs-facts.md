# 07 AI-friendly docs: facts (researched 2026-10-14)

Input for shipping `llms.txt`, `llms-full.txt`, a `.md` URL per page and a "Copy as Markdown" button on the multi-product Docusaurus 3.10 site (~16 products, per-product versions, ~6,600 Latest pages, ~23,000 pages across versions, older versions are frozen prebuilt snapshots).

Builds on [wso2-docs-elements research 01](../../wso2-docs-elements/research/01-site-features.md) sections 3 and 4 (GitHub, GitLab, Cloudflare, Stripe, Microsoft, HashiCorp). That work is not repeated here; only new sites and re-measured sizes are added.

All sources accessed 2026-10-14. **[unverified]** marks facts not confirmed in a primary source. **[inference]** marks my reasoning, not a sourced fact. "Implication" lines are suggestions for review, not decisions. Sizes are bytes downloaded with curl on 2026-10-14.

## TL;DR

- **The spec is now v2 (August 2026).** Only the H1 is required. A file may sit at any subpath and covers the pages under it; agents use the most specific one. Per-page Markdown is `page.md` or `page.html.md` (`index.md` for directory URLs). Discovery is `rel="alternate" type="text/markdown"` plus `rel="describedby"` for the llms.txt, as `<link>` or HTTP `Link:` header. The file "stays small enough to fit in context". **`llms-full.txt` is not in the spec**; it is a vendor convention.
- **Big multi-product sites split llms.txt per product.** Cloudflare: root 17 KB index of per-product files, `/workers/llms.txt` 87 KB, `/workers/llms-full.txt` 5.2 MB, site-wide `llms-full.txt` 68 MB. Mintlify caps a generated llms.txt at 100,000 characters and splits into `/_llms/*.txt` sub-indexes. Next.js has a per-version `/docs/14/llms.txt`. Anthropic `llms-full.txt` is 43.6 MB for 763 English pages.
- **Per-page Markdown:** `page.md` (Anthropic, Vercel, Next.js, Mintlify, Stripe, React Native) or `page/index.md` (Cloudflare, GitLab). Anthropic, Vercel, Next.js, Mintlify, Cloudflare also answer `Accept: text/markdown` on the HTML URL.
- **Docusaurus has no official plugin.** Issue facebook/docusaurus#10899 is open; maintainer is "not yet convinced" of the format. Two maintained community plugins, both MIT: **`@signalwire/docusaurus-plugin-llms-txt`** converts **rendered HTML** (used by React Native's Docusaurus 3.10 site); **`docusaurus-plugin-llms`** (rachfop) converts **source MDX** with string cleaning and inlines partials.
- **Fidelity:** rendered HTML captures what readers see (our `<DeploymentValue>` values live in props and only exist after render); source MDX keeps tab labels and semantics. Neither is free. A converter that works on our own MDX AST, with per-component Markdown serialisers, gets both **[inference]**.
- **Do agents fetch llms.txt?** Rarely. Ahrefs (137K domains, May 2026): 97% of llms.txt files got zero requests. Google Search says it ignores llms.txt. Coding agents are the real consumers: Claude Code ranked second after GPTBot in Ahrefs' fetch data, and Claude Code and Cursor send `Accept: text/markdown` first (Checkly test). Markdown per page plus negotiation matters more than llms-full.txt.

## 1. llms.txt spec and how large sites do it

### Spec (llmstxt.org v2)

| Fact | Source |
|---|---|
| Title "The /llms.txt file, v2", Jeremy Howard, first published 2024-09-03. v2 dated August 2026. | https://llmstxt.org/index.md, https://llmstxt.org/changes.md |
| Required order: optional BOM; "An H1 with the name of the project or site. This is the only required section"; optional blockquote summary; optional non-heading Markdown; optional H2 "file lists", each item a required `[name](url)` then optional `: notes`. | https://llmstxt.org/index.md |
| Placement: `/llms.txt` "or at any subpath (e.g. `/docs/llms.txt`). A file covers the URLs under its path, and where more than one file applies, agents should use the most specific one." v1 permitted subpaths without defining them; v2 defines coverage. | https://llmstxt.org/index.md, https://llmstxt.org/changes.md |
| Size: no number. "The file itself stays small enough to fit in context. The detail lives behind the links, and is fetched only when needed." | https://llmstxt.org/index.md |
| Per-page Markdown: same URL "with `.md` appended (`page.html.md`) or with the extension replaced by `.md` (`page.md`)". URLs without file names "should append `index.html.md` or `index.md`". v1 allowed only `page.html.md`. | https://llmstxt.org/index.md, https://llmstxt.org/changes.md |
| Discovery: `rel="alternate" type="text/markdown"` to a page's Markdown; `rel="describedby"` to the covering llms.txt; as HTML `<link>` or HTTP `Link:` header. Example: `Link: </docs/page.html.md>; rel="alternate"; type="text/markdown", </docs/llms.txt>; rel="describedby"`. | https://llmstxt.org/index.md |
| `Optional` H2: convention for skippable secondary links. v2 removed its mechanical meaning and dropped the `llms_txt2ctx` context-expansion tooling. | https://llmstxt.org/changes.md |
| **`llms-full.txt` is not mentioned** in v2. It is a convention from documentation platforms (Mintlify documents it as its own feature). | https://llmstxt.org/index.md, https://www.mintlify.com/docs/ai/llmstxt.md |
| Spec rejects `/.well-known/` as the primary location because it exists only at origin root. Mintlify nevertheless also serves `/.well-known/llms.txt` and `/.well-known/llms-full.txt`. | https://llmstxt.org/index.md, https://www.mintlify.com/docs/ai/llmstxt.md |
| Mentions `docusaurus-plugin-llms` (rachfop) in its tools list. | https://llmstxt.org/index.md |

### Reference sites (measured 2026-10-14)

| Site | llms.txt | llms-full.txt | Per product / per version | Notes |
|---|---|---|---|---|
| Cloudflare | Root 16.9 KB: a directory of per-product `llms.txt` links grouped by category | Site-wide 68.1 MB; `/workers/llms-full.txt` 5.2 MB | **Per product** (`/workers/llms.txt` 87 KB). No versions | Each `.md` starts with a "Documentation Index" blockquote pointing to the product llms.txt. Built by `src/pages/[...product]/llms.txt.ts` |
| Anthropic (platform.claude.com; docs.anthropic.com and docs.claude.com redirect) | 83.3 KB, one file, 763 English page links (`.md`), lists 12 other languages by count but links English only | 43.6 MB | No per-product split | Points to a docs MCP server in the file |
| Vercel | `/llms.txt` 4.9 KB (`/docs/llms.txt` redirects there): agent guidance plus links to curated indexes (`/docs/products.md`, `/docs/sitemap.md`) | `/docs/llms-full.txt` 10.6 MB | Index of indexes, not per product files | Uses `?from=llms-txt` on some links (tracking parameter) |
| Next.js | `/docs/llms.txt` 51 KB, carries `@doc-version: 16.4.0` | `/docs/llms-full.txt` 4.25 MB | **Per version**: `/docs/14/llms.txt` 29 KB (`@doc-version: v14.2.35`); `/docs/14/llms-full.txt` 404. Also `/docs/pages/llms.txt` per router | Older-version index only, no older full file |
| Mintlify (its own docs) | 23 KB | 1.65 MB | Default language and **default version only** | Generated llms.txt capped at **100,000 characters**; overflow split into `/_llms/<group>.txt` sub-indexes, followed recursively |
| React Native (Docusaurus 3.10, versioned) | 104 KB | 2.25 MB | Latest only (`includeVersionedDocs: false`) | `@signalwire/docusaurus-plugin-llms-txt` |
| Stripe | 92.8 KB | 404 | n/a | See prior research |
| GitLab | 87 KB | Redirects to sign-in (none) | n/a | See prior research |
| HashiCorp developer | 404 | n/a | n/a | See prior research |
| OpenAI developers | 6.2 KB | not checked | n/a | |
| Gemini API (`/gemini-api/docs/llms.txt`) | 37 KB, at a subpath | not checked | n/a | |
| docusaurus.io | 404 | n/a | n/a | Docusaurus's own site has none |

Sources: direct fetches of each URL above; https://www.mintlify.com/docs/ai/llmstxt.md; https://github.com/facebook/react-native-website/blob/main/website/docusaurus.config.ts; https://github.com/cloudflare/cloudflare-docs (`src/pages/[...product]/llms.txt.ts`, `src/pages/llms.txt.ts`).

Implication **[inference]**: at ~110 bytes per link line, a single llms.txt for 6,600 Latest pages is ~700 KB, about 7x Mintlify's cap and well past "fits in context". The Cloudflare shape fits: root `/llms.txt` lists the ~16 products, `/identity/llms.txt` indexes the product's Latest pages, optional `/identity/7.2.0/llms.txt` per version (spec's "most specific file" rule makes this valid). A site-wide llms-full.txt would likely be tens of MB (Cloudflare 68 MB, Anthropic 44 MB); per-product llms-full.txt (Cloudflare ~5 MB for Workers) is the useful size, and frozen versions could ship none (Next.js pattern).

## 2. Per-page Markdown URLs and "Copy page" UX

### URL convention (measured)

| Site | `.md` form | `Accept: text/markdown` on HTML URL | Discovery hint |
|---|---|---|---|
| Anthropic | `/docs/en/<page>.md` | Yes. Markdown response has `Vary: Accept` and `Link: <html url>; rel="canonical"` | `<link rel="alternate" type="text/markdown">` in HTML **and** `Link:` header on the HTML response |
| Vercel | `/docs/<page>.md`; also `/docs/<page>.graph.md` ("Cross-link map") | Yes. Note: a request with `Accept: */*` (curl default, or `Claude-User` UA) also gets Markdown; a browser `text/html` Accept gets HTML | `<link rel="alternate" type="text/markdown">` (two of them) |
| Next.js | `/docs/<page>.md` (latest only; `/docs/14/...md` 404) | Yes, including v14 pages; same `*/*` behaviour as Vercel | not observed in HTML |
| Mintlify | `<page>.md` (`x-robots-tag: noindex` on it) | Yes, `text/markdown` or `text/plain` | `<link rel="alternate" type="text/markdown">`; `Link:` header with non-standard rels `llms-txt`, `llms-full-txt`, `api-catalog`, `mcp-server-card`, `agent-skills`; `X-Llms-Txt` header. Markdown 404 body points to llms.txt and related pages |
| Cloudflare | `<page>/index.md` | Yes, via Cloudflare's edge "Markdown for Agents" feature (HTML converted on the fly; adds `content-signal` header) | `<link rel="alternate">` (prior research) |
| React Native | `/docs/<page>.md` (latest only; `/docs/0.79/...md` 404) | not checked | none |
| Stripe, GitHub, GitLab, Microsoft | see prior research section 3 | | |

Sources: curl of `https://platform.claude.com/docs/en/build-with-claude/prompt-caching`, `https://vercel.com/docs/functions`, `https://nextjs.org/docs/app/getting-started/installation`, `https://www.mintlify.com/docs/quickstart`, `https://reactnative.dev/docs/flatlist.md`; https://www.mintlify.com/docs/ai/markdown-export.md; https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/index.md.

Note: none of the sites measured uses the spec's `rel="describedby"`; Mintlify uses its own `rel="llms-txt"`. Cloudflare and Mintlify instead embed a text pointer to llms.txt at the top of every `.md`.

Implication **[inference]**: a static Docusaurus build can emit `<page>.md` files and `<link rel="alternate">` tags with no runtime. `Accept` negotiation and `Link:` headers need CDN or server config (the docs host's rules), not page code. If negotiation is added, send `Vary: Accept` and only serve Markdown when `text/markdown` is explicitly preferred; Vercel's `*/*` behaviour would serve Markdown to generic clients.

### Copy page UX

| Site | Label(s) seen in server HTML | Menu items |
|---|---|---|
| Anthropic | "Copy page" | **[unverified]** further items are client-rendered; not inspected in a browser |
| Vercel | "Copy page", "Ask AI" | **[unverified]** |
| Next.js | "Copy page", "Copy for LLM", "Ask AI" | **[unverified]** |
| Stripe | "Copy for LLM", "View as Markdown", "Ask AI" | Prior research: Ask about this page, Copy for LLM, View as Markdown, Install tools |
| Mintlify | Contextual menu in page header (or TOC via `display: "toc"`) | Configurable: Copy page, View as Markdown, Ask assistant, Open in ChatGPT / Claude / Perplexity / Grok / AI Studio / Devin, MCP connect, Download PDF |

Sources: grep of server HTML of the pages above; https://www.mintlify.com/docs/ai/contextual-menu.md.

Privacy note: "Open in ChatGPT/Claude" items pass the page URL to a third-party site in a query string (prior research, GitLab `copy_for_llm.vue`). Our scope is Copy as Markdown only, which needs no third party.

## 3. Docusaurus plugins

No official Docusaurus feature. `@docusaurus/plugin-llms-txt` does not exist on npm. Issue [facebook/docusaurus#10899](https://github.com/facebook/docusaurus/issues/10899) (open since 2025-02-04): maintainer slorber first declined core inclusion (2025-02-06), then wrote "we should consider implementing such a plugin in Docusaurus core" (2025-05-23) and sketched a `postBuild({routes, routesBuildMetadata})` design. In discussion [#11191](https://github.com/facebook/docusaurus/discussions/11191) he wrote he is "not yet convinced of the usefulness of this weird file format that everybody produces, but not sure any crawler consumes it." [#11333](https://github.com/facebook/docusaurus/issues/11333) "Copy Page Button" is open. The v4 umbrella issue #11719 does not mention llms.txt.

| | `@signalwire/docusaurus-plugin-llms-txt` | `docusaurus-plugin-llms` (rachfop) | `docusaurus-markdown-source-plugin` (FlyNumber) | `docusaurus-plugin-copy-page-button` (portdeveloper) | `docusaurus-plugin-llms-txt` (jverre) |
|---|---|---|---|---|---|
| Licence (npm) | MIT; LICENSE file in repo | MIT on npm and README; **GitHub API detects no LICENSE file** | MIT | MIT on npm; **no LICENSE file in repo** | MIT |
| Latest stable | 1.2.2 (2025-07-23). 2.0.0-alpha.7 (2025-11-10). README on `main` documents v2 | 0.6.1 (2026-10-03) | 2.2.5 (2026-05-03) | 0.8.5 (2026-10-12) | 0.1.3 (2024-12-30), no repo link: **abandoned** |
| Stars / open issues+PRs | 32 / 13 (7 are Dependabot PRs) | 146 / 2 | 45 / 3 | 16 / 2 | n/a |
| Generates from | **Rendered HTML** in `postBuild`: CSS selector extraction then rehype, rehype-remark, remark-stringify | **Source MD/MDX**, string cleaning (deps are only `yaml`, `minimatch`, `gray-matter`, so no MDX parser) | Source file via `route.metadata.sourceFilePath`, strips imports and MDX components, converts HTML back | Client side, from the page DOM **[unverified mechanism]**; optional `generateMarkdownRoutes` | Source |
| Outputs | llms.txt, opt-in llms-full.txt, per-page `.md` mirroring routes; copy button via separate `@signalwire/docusaurus-theme-llms-txt` | llms.txt, llms-full.txt, opt-in per-page `.md`, custom LLM files | per-page `.md` + dropdown (View / Copy) | Copy / View / Open in ChatGPT, Claude, Perplexity, Gemini | llms.txt |
| Versions | `includeVersionedDocs`: markdown default `true`, llms.txt default `false`; detects `__docusaurus_isVersioned` on routes. One root llms.txt; sections are headings, not separate files **[unverified: no per-path file option found in README]** | `versions` option: one llms.txt set per version under its own path (e.g. `/stable/llms.txt`), or `'auto'` | Handles versioned docs, routeBasePath, i18n (README) | n/a | n/a |
| Multi-instance docs | Route-glob based, so all instances included **[inference]** | Supported (README: "multi-instance docs") | via route tree | n/a | n/a |
| MDX components | Whatever the HTML renders. No tab-specific handler in `src/transformation/plugins` (only code blocks, links, tables) | Strips PascalCase tags, keeps inner text; `<TabItem>` label emitted as a bold line; `preserveComponents` keeps named tags with props raw; partials (`_*.mdx`) inlined, including `@site/` imports | Strips | n/a | n/a |
| Runtime deps (direct) | 12 (unified, rehype-parse, rehype-remark, remark-gfm, remark-stringify, hast-util-*, unist-util-visit, p-map, fs-extra, string-width) | 3 (exact pins) | 1 (`fs-extra`) | 0 (peer only) | 2 |
| Install scripts | none | none | none | none | none |
| Used by | React Native website (`^1.2.2`, `includeVersionedDocs: false`, `enableLlmsFullTxt: true`) | listed on llmstxt.org | | | |

Sources: `npm view <pkg>` (2026-10-14); `gh api repos/<owner>/<repo>`; https://github.com/signalwire/docusaurus-plugins (`packages/docusaurus-plugin-llms-txt/README.md`, `src/discovery/content-classifier.ts`, `src/transformation/html-parser.ts`); https://github.com/rachfop/docusaurus-plugin-llms (`README.md`, `docs/multi-version.md`, `docs/content-cleaning.md`, `docs/content-generation.md`); https://github.com/FlyNumber/markdown_docusaurus_plugin `README.md`; https://github.com/portdeveloper/docusaurus-plugin-copy-page-button `README.md`.

Supply-chain notes:

- All are single-vendor or single-maintainer packages (SignalWire has 3 npm maintainers; the others 1 each). None has install scripts.
- signalwire stable 1.2.2 is 15 months old while `main` documents an unreleased v2; adopting 1.x means following docs on npm, not GitHub. 13 open items include "Accept header" support (#30) and a `routeRules` bug with non-root `baseUrl` (#27).
- The theme package's latest version is a canary (`0.0.0-canary-20250918205207`) that pins `react-icons` 5.5.0 and lists `@docusaurus/core` as a dependency, not a peer.
- Missing LICENSE files (rachfop, portdeveloper) should go to legal review before copying code; npm metadata alone is weak evidence.
- Copy-button plugins default to "Open in ChatGPT/Claude/..." links; disable them or they send page URLs to third parties.
- Implication **[inference]**: our site already has its own converter package (`docs-site/packages/docs-converter`). The plugin logic is small (route walk, string building, file write); writing our own `postBuild` plugin avoids the dependency and handles our components exactly.

## 4. Markdown from rendered HTML vs from MDX source

| Fact | Source |
|---|---|
| Docusaurus `<Tabs>` (default `lazy=false`) server-renders **every** `<TabItem>`; unselected panels get the `hidden` attribute. Tab labels are rendered separately in a `<ul role="tablist">` above the panels. So HTML conversion sees all panel contents but the label-to-panel link is only by order. | https://github.com/facebook/docusaurus/blob/v3.10.0/packages/docusaurus-theme-classic/src/theme/TabItem/index.tsx, `.../Tabs/index.tsx` |
| Sentry (8,754 pages, MDX) built `.md` from Next.js pre-rendered HTML with rehype-remark because shared content blocks mean "the MDX must be rendered before the full text can be extracted"; cost was 6 to 7 minutes before caching and parallelising. | https://byk.im/posts/marking-it-up-and-down/ (2025-07-02) |
| Mintlify serves source MDX: its `.md` output contains raw `export const PreviewButton = ...` JSX and `<Note>`, `<ResponseField>` tags. It offers `<Visibility for="agents">` / `for="humans">` to tailor Markdown. | https://www.mintlify.com/docs/ai/llmstxt.md, https://www.mintlify.com/docs/ai/markdown-export.md |
| Cloudflare's edge HTML-to-Markdown output includes page chrome such as `[Skip to content](#main-content)` and the action bar text. | https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/index.md |
| GitLab ships raw source and shortcodes leak (prior research). | [prior research](../../wso2-docs-elements/research/01-site-features.md) section 3 |
| Our `<DeploymentValue cloud selfHosted>` holds its values **only in props**; `<Applies to>` renders a visible "X only" label div. | `docs-site/site/src/components/DeploymentValue.js`, `Applies.js` |

Trade-offs for our components **[inference]**:

| Component | From rendered HTML | From source, generic tag stripping (rachfop default) |
|---|---|---|
| `<DeploymentValue>` | Correct: "`x` (WSO2 Cloud) / `y` (Self-hosted)" | **Value lost** (self-closing, props only) unless preserved raw as JSX |
| `<Applies to="WSO2 Cloud">` | Label text kept ("WSO2 Cloud only"), block boundary lost | Label lost, content merges with surrounding text |
| Tabs | All panels kept, labels detached from panels | Labels kept as bold lines |
| Partials | Expanded | Expanded only if the tool resolves imports (rachfop does) |
| Admonitions | Rendered title/icon text; type may be lost | `:::note` kept as directive syntax |
| Stepper, custom React | Whatever renders, plus UI noise unless selectors are tight | Raw tags or stripped |
| Frozen older versions | Only option that works if we keep prebuilt HTML only | Needs the MDX source of each frozen version |

Conclusion **[inference]**: neither generic path preserves fidelity. The highest fidelity is to serialise from our own MDX AST (we already parse it in `docs-converter`), with a per-component Markdown rule (e.g. `Applies` to a labelled blockquote, `DeploymentValue` to the same text the component renders, `TabItem` to a labelled sub-heading) and partials expanded. For frozen snapshots without source, HTML conversion restricted to `.theme-doc-markdown` is the fallback. Test each component's output against the rendered page.

## 5. Do AI crawlers and agents fetch llms.txt?

| Fact | Source |
|---|---|
| Ahrefs, 137,210 domains, May 2026 (published 2026-06-15): 28% publish llms.txt; **97% of those files got zero requests**; 96% of requests were from bots. Share of requests: GPTBot 4.51%, ClaudeBot 0.8%, OAI-SearchBot 0.74%, AI assistants 2.5% total; Claude-Code out-fetched every AI bot except statespace-indexer and GPTBot. Googlebot fetched ~900 times. SEO audit tools 21.7%. Limits: technical customer base, only the index file measured, "fetched" is not "read". Did not study llms-full.txt or `.md`. | https://ahrefs.com/blog/llmstxt-study/ |
| Google Search: "Google Search itself doesn't use them ... It's completely fine if you decide to create and maintain LLMS.txt files ... for other services ... Doing so will neither harm nor help your site's visibility or rankings in Google Search". Changelog entry 2026-06-15 "Clarifying guidance on llms.txt files". | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide, https://developers.google.com/search/updates |
| Chrome Lighthouse has an llms.txt audit under "Agentic browsing": checks root `/llms.txt`; server error fails; 404 is "Not Applicable"; "providing the file is optional at the moment". Last updated 2026-05-05. | https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt |
| Accept headers captured from coding agents (one request each, Feb 2026): Claude Code 2.1.38 `text/markdown, text/html, */*`; Cursor 2.4.28 and OpenCode 1.2.5 also put Markdown first. OpenAI Codex, Gemini CLI, GitHub Copilot, Windsurf did not ask for Markdown. Vendor blog, small sample. | https://www.checklyhq.com/blog/state-of-ai-agent-content-negotation/ |
| No public statement found from OpenAI or Anthropic that their crawlers or answer systems read llms.txt. Anthropic, OpenAI and Gemini all publish llms.txt for their own developer docs. **[unverified: absence of evidence from searches only]** | https://llmstxt.org/index.md (lists them) |
| robots.txt: no llms.txt directive exists in the spec. Cloudflare's robots.txt adds `Content-Signal: ai-train=yes, search=yes, ai-input=yes` (Cloudflare's content-signals convention). Anthropic's robots.txt only lists sitemaps and `Disallow: /api/`. | https://developers.cloudflare.com/robots.txt, https://platform.claude.com/robots.txt |
| Several self-published log studies (83 sites, 48 days, etc.) report single-digit llms.txt fetches by OpenAI/Anthropic bots versus thousands of robots.txt fetches. **[unverified: secondary, small, unreviewed]** | https://www.ezy.ai/research/do-ai-bots-read-llms-txt, https://www.wislr.com/articles/ai-bot-behavior-log-analysis/ |

Implication **[inference]**: llms.txt is cheap and harmless but low-traffic; the users that matter are coding agents (Claude Code, Cursor) fetching docs pages on demand. Priority: clean per-page `.md`, `<link rel="alternate" type="text/markdown">`, then per-product llms.txt. Accept negotiation is a host-config follow-up. llms-full.txt is the lowest value per byte and the largest artefact; per product, Latest only.

## Open questions

- Docs host: can it set `Link:` headers and `Accept`-based routing for static files? (Not researched here.)
- Whether frozen version snapshots keep their MDX source, which decides HTML vs source conversion for them.
- Anthropic, Vercel and Next.js copy-menu contents beyond the button label (needs a browser).
