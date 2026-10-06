# Product gap audit (as of 2026-10-02)

Answers [ticket 02](../issues/02-product-gap-audit.md). Builds on [00-initial-landscape](00-initial-landscape.md).

Method: WebFetch of live pages (wso2.com blocks curl with 403, so wso2.com status comes from WebFetch); curl for non-wso2.com hosts; shallow clones of the docs repos on GitHub for text counts and config. Confidence: H = fetched or read in source; M = search result only. Counts are raw grep hits in Markdown source and include URLs, code and identifiers unless stated.

Severity: **blocker** = primary reader cannot reach a working result or lands on a dead page; **notable** = confusing or misleading, workaround exists; **minor** = polish.

## Agent Manager

| # | Gap | Evidence | Sev | Conf |
|---|---|---|---|---|
| A1 | Product page "View the docs" CTA is a 404 | https://wso2.com/agent-platform/agent-manager/ links `https://wso2.github.io/agent-manager/docs/v1.0.0/get-started/what-is-amp/`, which curl returns 404 | blocker | H |
| A2 | Docs default to self-hosted v1.0.0, and Cloud is hidden as a "version" tab. The home page CTAs ("Get started", quick-start dev container) all go to v1.0.0 | `lastVersion: latestVersion` and versions `v1.0.0`, `cloud` in docusaurus.config.ts / versions.json (github.com/wso2/docs-agent-platform); https://wso2.com/agent-platform/docs/ quick start points at `/v1.0.0/get-started/quick-start/` (Docker) | notable | H |
| A3 | Cloud has no Get Started quick start. Its Get Started folder holds only `what-is-amp`, and the real sign-up-to-agent path is a tutorial | https://wso2.com/agent-platform/docs/cloud/get-started/what-is-amp/ (Cloud sidebar shows a Quick Start link that resolves to v1.0.0); working path is https://wso2.com/agent-platform/docs/cloud/tutorials/create-your-first-agent/ (last updated 2026-09-24) | notable | H |
| A4 | wso2.com/documentation links Agent Manager to `/agent-platform/docs/v1.0.0/` instead of Cloud | https://wso2.com/documentation | notable | H |
| A5 | SaaS vs self-hosted is not explained in the Cloud docs ("What is AMP" does not address it). Only the product page contrasts them | https://wso2.com/agent-platform/docs/cloud/get-started/what-is-amp/ ; https://wso2.com/agent-platform/agent-manager/ | notable | H |
| A6 | Cross-product links are weak. Cloud docs link API Platform only to the GitHub repo (concepts/gateway.mdx); no links to Identity Platform docs, even though the product page sells "Agent ID" and AI Gateway | `versioned_docs/version-cloud/concepts/gateway.mdx` → github.com/wso2/api-platform | notable | H |
| A7 | Product page text still lists former names (Choreo, Asgardeo, Bijira, Devant), likely in nav or product listings | https://wso2.com/agent-platform/agent-manager/ (exact location on page not determined) | minor | M |
| A8 | Freshness is good: "last updated" is shown per page and the repo was pushed 2026-10-02 | `showLastUpdateTime: true`; GitHub API pushed_at | none | H |

## Identity Platform

| # | Gap | Evidence | Sev | Conf |
|---|---|---|---|---|
| I1 | Sign-up and console still go to Asgardeo domains: product page "Sign Up" → `https://asgardeo.io/signup` (200); docs give consoles `console.asgardeo.io` / `console.eu.asgardeo.io` | https://wso2.com/identity-platform/ ; `get-started/create-identity-platform-account.md` (github.com/wso2/docs-is `en/asgardeo/`) | notable | H |
| I2 | The getting-started path is clear and cloud-first (create account → React quick start). A banner explains "Asgardeo is now WSO2 Identity Platform" | https://wso2.com/identity-platform/docs/ | none (strength) | H |
| I3 | Stale name in visible text: one tutorial hard-codes `product_name = "Asgardeo"`. Other hits (28 total) are mostly SDK identifiers (`AsgardeoProvider`, `@asgardeo/react`), which are legitimate | `docs/tutorials/agent-id-claude-authentication.md` line 1 | minor | H |
| I4 | `site_url` is still `https://wso2.com/asgardeo/docs/`, so canonical and sitemap URLs may point at the redirecting old path | `en/asgardeo/mkdocs.yml` line 22 | minor | H (config); impact M |
| I5 | Cross-product links point to Choreo, not the WSO2 Cloud products. Action-hosting guides are "...-in-choreo" and the Branding AI quick start uses choreo.dev. There are no links to API, Integration or Agent Manager docs | `docs/complete-guides/actions/pre-issue-access-token-action-in-choreo.md` etc.; grep for api-platform/integration-platform/agent-platform: 0 hits | notable | H |
| I6 | SaaS vs self-managed is clear: a header toggle, with the self-managed docs at is.docs.wso2.com | https://wso2.com/identity-platform/docs/ | none | H |
| I7 | No page-level "last updated" date, because no revision-date plugin is configured. The repo itself is active (pushed 2026-10-02) | `mkdocs.yml` plugins list; GitHub API | minor | H |

## API Platform

| # | Gap | Evidence | Sev | Conf |
|---|---|---|---|---|
| P1 | Sign-up goes to `console.bijira.dev/login`. Docs reference bijira.dev 277 times, some written as `console.Bijira.dev` | https://wso2.com/api-platform/ ; `docs/cloud/workflows/submit-workflow-requests.md` (github.com/wso2/docs-api-platform) | notable | H |
| P2 | Former names appear in visible text. "Bijira" has 37 hits in 12 files, including a whole guide written around "Bijira Project / Bijira Console" and the landing page's "Cloud (Bijira) users". "Asgardeo" has 237 hits (e.g. "Secure API Access with Asgardeo"). The URL slugs `what-is-bijira`, `bijira-concepts` and `integrate-bijira-with-moesif` are also stale | `docs/guides/ai-and-mcp/build-ai-agent-with-multiple-mcp-servers.md`; `docs/index.md:190`; `docs/cloud/develop-api-proxy/.../secure-api-access-with-asgardeo.md` | notable | H |
| P3 | wso2.com/documentation still lists the SaaS as "Bijira" with a `/bijira/docs/` link | https://wso2.com/documentation | notable | H |
| P4 | Old deep links (`/bijira/docs/...`) return a "Redirecting..." page; whether each one reaches the matching new page was not verified | https://wso2.com/bijira/docs/introduction/quick-start-guide/ | minor | M |
| P5 | Cloud getting-started exists (Cloud > Introduction > Quick Start, API proxy or MCP), but it sits third in the nav after Overview and Get Started, which mix cloud, APIM and self-hosted gateways | https://wso2.com/api-platform/docs/ ; `docs/cloud/introduction/quick-start-guide.md` (last_updated 2026-06-30) | minor | H |
| P6 | Deployment options are well separated (a Cloud section plus versioned self-hosted gateway sections; data planes explained as cloud, hybrid, self-managed or federated) | `docs/index.md` (Data Planes bullet); https://wso2.com/api-platform/ | none (strength) | H |
| P7 | Cross-product links point to old paths or Choreo: 9 links to `wso2.com/asgardeo/docs/` instead of `/identity-platform/docs/`; an MCP guide says "deploy the image on Choreo" (wso2.com/choreo/docs/ now redirects to engineering-platform). There are no links to Integration Platform or Agent Manager | `docs/guides/ai-and-mcp/expose-a-multi-step-api-workflow-as-an-mcp-tool.md:223`; curl of wso2.com/choreo/docs/ | notable | H |
| P8 | `last_updated` front matter is present on 1040 of 1062 pages, but the theme renders only git revision dates, which are not configured, so readers probably see no date | `theme/material/partials/content.html:34`; mkdocs.yml plugins | minor | H (config); render M |

## Integration Platform

| # | Gap | Evidence | Sev | Conf |
|---|---|---|---|---|
| G1 | The docs call the cloud product **"WSO2 Cloud"** ("Sign in to [WSO2 Cloud](https://console.devant.dev)", page title "WSO2 Cloud - Integration Platform"). That collides with WSO2 Cloud as the umbrella family | `docs/manage/cloud/overview.md`, `integrations.md:13` (github.com/wso2/docs-integrator); https://wso2.com/integration-platform/docs/get-started/setup/cloud-setup ("Sign up for WSO2 Cloud") | notable | H |
| G2 | Every old Devant deep link collapses to one overview page, so bookmarks and blog links lose their target. Example: `/devant/docs/quick-start-guides/develop-your-first-integration-as-api/` → `/integration-platform/docs/manage/cloud/overview` | WebFetch of that URL; curl of `/devant/docs/` | notable | H |
| G3 | Cloud is buried. The docs home leads with "Build your first integration", where install or cloud editor is an option and cloud deploy is step 5. Cloud ops live under Manage > Cloud, and the home page does not label cloud vs self-hosted | https://wso2.com/integration-platform/docs/ ; `docs/get-started/build-automation.md` lines 23, 119 | notable | H |
| G4 | "Devant" appears in visible text 422 times, almost all as "Deploy to Devant" badges (alt text plus badge image hosted on choreoapps.dev) in about 189 connector examples. The badge alt text in the quick starts was updated, but the image still says Devant | `docs/connectors/catalog/database/postgresql/example.md:124`; `docs/get-started/build-automation.md:128` | minor | H |
| G5 | Product page sign-up goes to `console.devant.dev` | https://wso2.com/integration-platform/ | notable | H |
| G6 | The site brands itself "WSO2 Integrator Documentation" (in page titles), not Integration Platform | https://wso2.com/integration-platform/docs/manage/cloud/private-date-plane/overview | minor | H |
| G7 | Typo in a public URL slug: `private-date-plane` | same URL | minor | H |
| G8 | Hybrid is documented well (Private Data Plane vs Cloud Data Plane, updated 2026-05-14). Billing exists only here | same URL; `docs/manage/cloud/billing` | none (strength) | H |
| G9 | Cross-product links go only to Identity Platform, via 7 old `wso2.com/asgardeo/...` links. There are none to API Platform (despite `manage/cloud/api-management`) or Agent Manager | grep of `en/docs` | notable | H |
| G10 | The superseded repo github.com/wso2/docs-devant is not archived (pushed 2026-07-28) and its README still sends contributors to wso2.com/devant/docs/ | GitHub API; repo README | minor | H |

## API Analytics Platform (Moesif)

| # | Gap | Evidence | Sev | Conf |
|---|---|---|---|---|
| M1 | No WSO2-side product or docs entry: `wso2.com/api-analytics-platform/` returns 404, and wso2.com/documentation does not list Moesif | WebFetch 404; https://wso2.com/documentation | blocker (for a hub link target) | H |
| M2 | The docs never use "API Analytics Platform" and are fully Moesif-branded. There is no WSO2 ownership context on the docs home | https://www.moesif.com/docs/ (grep of HTML: 0 hits) | notable | H |
| M3 | The getting-started overview is stale (last updated 2025-02-28) and gives no explicit sign-up link or path to a first result | https://www.moesif.com/docs/getting-started/overview/ | notable | H |
| M4 | WSO2 integration pages are current (2026-09-02) but use mixed naming. The slug is `wso2-bijira` while the text says "WSO2 API Platform", and Choreo still has its own guide | https://www.moesif.com/docs/server-integration/wso2-bijira/ ; sitemap `server-integration/wso2-choreo/` | minor | H |
| M5 | Deployment model is SaaS only. Secure Proxy (customer-hosted encryption proxy, 2026-08-17) is the hybrid-like option and there is no self-hosted Moesif. None of this is stated in WSO2 terms (SaaS / hybrid / self-hosted) | https://www.moesif.com/docs/platform/secure-proxy/ | notable | H |
| M6 | Cross-product links cover only API Manager, API Platform, Kubernetes Gateway and Choreo. There is nothing for Identity, Integration or Agent Manager, though the Bijira page notes sign-in via the "Identity Platform option" | https://www.moesif.com/docs/ nav | minor | H |
| M7 | API Platform is the de facto entry point ("Moesif Basic", "powered by Moesif", linking `moesif.com/moesif-basic`). Its page "Integrate API Platform with Moesif" sits at a `bijira` slug | https://wso2.com/api-platform/ ; https://wso2.com/api-platform/docs/cloud/monitoring-and-insights/integrate-bijira-with-moesif/ | minor | H |

## Cross-product summary (top gaps)

1. **Dead or wrong entry links (blocker).** The Agent Manager product page's docs CTA is a 404 (A1). API Analytics has no WSO2 product or docs URL (M1). wso2.com/documentation sends Agent Manager readers to self-hosted v1.0.0 (A4), still says "Bijira" (P3), and omits Moesif.
2. **Sign-up and consoles run on former names everywhere** (I1, P1, G5): asgardeo.io, console.bijira.dev, console.devant.dev. Only Agent Manager has a WSO2 Cloud domain. Docs cannot fix this alone; the hub needs a "former name ↔ product" table.
3. **Cloud getting-started is not first-class in 3 of 5 products.** Agent Manager's is a tutorial under a Cloud "version" (A2, A3). Integration's is step 5 behind Manage > Cloud (G3). Moesif's is stale (M3). Identity Platform is the model to copy (I2).
4. **"WSO2 Cloud" is already used as a product name.** Integration Platform docs call their console "WSO2 Cloud" (G1), which will collide with the hub's umbrella term.
5. **Cross-product links barely exist and point to old paths or Choreo** (A6, I5, P7, G9, M6). No product links to Agent Manager; Identity and API Platform route integration scenarios to Choreo.
6. **Old-name deep links degrade.** Devant links collapse to one overview page (G2), Bijira redirects are unverified (P4), and several sites keep old `site_url` or slugs (I4, P2).
7. **Freshness is visible only for Agent Manager and Integration** (A8, G8). Identity and API Platform show no page dates (I7, P8), and Moesif's getting-started page is 19 months old (M3).
