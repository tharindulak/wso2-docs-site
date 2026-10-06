# Where cross-cutting topics live today across the five product docs (2026-10-02)

Ticket: [01](../issues/01-cross-cutting-topics-today.md). Builds on [00-initial-landscape](00-initial-landscape.md).

Confidence: **H** = page source fetched (GitHub raw from the docs repo, or WebFetch of the live page); **M** = search result or URL resolves but content not readable. "Updated" = last git commit on the source file (GitHub API) unless stated as the page's own `last_updated` / "Last Updated" footer.

Source repos read: `wso2/docs-agent-platform` (`versioned_docs/version-cloud/`), `wso2/docs-is` (`en/asgardeo/`), `wso2/docs-api-platform` (`en/docs/`), `wso2/docs-integrator` (`en/docs/`). Published URLs below follow each repo's path-to-URL scheme; repo paths are given where a published URL was not separately fetched.

Abbreviations: AM = Agent Manager, IdP-Plat = Identity Platform, APIP = API Platform, IntP = Integration Platform, Moesif = API Analytics Platform.

## Matrix

| Topic | AM | IdP-Plat | APIP | IntP | Moesif |
|---|---|---|---|---|---|
| What WSO2 Cloud is | None. "What is AMP" describes the product only, built on OpenChoreo (H) | None. Ops policies call it "IDaaS managed by WSO2" (H) | None. Docs home describes Cloud / Hybrid / Self-managed for APIP only (H) | **Uses "WSO2 Cloud" as its own name**: "WSO2 Cloud - Integration Platform"; sign-up page says "WSO2 Cloud is the identity and access layer for WSO2 Integration Platform" (H) | None. Security page says Moesif "acquired by WSO2... independent subsidiary" (H) |
| How products fit together | Gateway is "a WSO2 API Platform component" (H) | Not covered | Docs home bundles "Moesif Analytics" into Cloud; Moesif Basic auto-enabled for orgs; Asgardeo as key manager guides (H) | Org creation provisions a matching Asgardeo org; Asgardeo as external IdP (H) | Lists "WSO2 API Platform", "WSO2 Choreo", "WSO2 API Manager" as integrations (H) |
| Sign-up and organizations | One line: sign up at console.agent-manager.cloud.wso2.com; Organization concept page (H) | Create account page; multiple root orgs per account; "Your WSO2 Identity Platform" section (H) | Org concept: **"A user can only create one organization"**; sign up via Google/GitHub/Microsoft (H) | Sign-up page: org name rules, persona, region pick (H) | Org = "your company's Moesif subscription", one region, fixed (H) |
| Users and access / enterprise login | Roles/scopes in Organization page; no enterprise-login guide (H) | Manage administrators + self-service "Admin SSO" (Console Settings > Enterprise Login) (H) | Groups/roles in org page; enterprise login **by support request** (bijira-help@wso2.com) + DNS TXT; "Inviting members" page exists but not in nav (H) | Users and access section; enterprise login **by support request** (devant-help@wso2.com) + DNS TXT, then federate in Asgardeo (H) | Apps and Team; SAML/Okta/ADFS/Entra SSO, Enterprise plan only (H) |
| Billing and subscriptions | None | Subscribe via billing portal / Azure Marketplace; ops policies sec. 7 (cycle, upgrade, downgrade, invoices) (H) | None for own WSO2 subscription. "Subscription plans" pages are API-consumer plans, not customer billing (H) | "Pricing and Plans" (platform services hourly billing, free plan limits) + "Usage Dashboards" (H) | Org page: team size per plan; no plan/invoice docs found (H) |
| Regions and data residency | None | Dedicated page: US (East US, Virginia) and EU (Northern Europe, Ireland); per-region consoles (H) | Only generic: Cloud Gateway "available across multiple cloud regions"; hybrid "satisfies the majority of data residency requirements" (H) | "Data Residency and Compliance" page (logs/metrics); managed DBs "US and EU regions"; Kafka US/EU/Australia; region step at sign-up (H) | Data residency page: Global (default) and EU (Azure West Europe), fixed at org creation (H) |
| SLA | None | Ops policies sec. 9: "We maintain a 99.99% SLA"; support SLAs per tier (H) | None | None | None on security page (H) |
| Security and compliance | Guides for securing agent endpoints only (H) | Ops policies: load/pen-test approval (14 days notice), rate limits, privacy policy link (H) | Compliance Dashboard = API governance, not platform compliance; PDP page (H) | Data residency/compliance page (encryption at rest, DSAR to dpo@wso2.com, breach notice); PDP security levels (H) | security page: SOC 2 Type 2, ISO 27001/27017 (Azure), GDPR/CCPA page, HIPAA claim (H) |
| Support | Footer: GitHub Discussions and Issues only (H) | Ops policies sec. 8: cloud-support.wso2.com, tiers; nav "Enterprise Support" links to pricing page; Discord (H) | Only in enterprise-login page (support portal / bijira-help@wso2.com) (H) | mailto devant-support@wso2.com (billing, Kafka); devant-help@wso2.com (enterprise login) (H) | support@moesif.com, in-app chat, Support Access page (H) |
| Status | None | status.asgardeo.io, in ops policies sec. 9 (H link; page JS-rendered, M content) | Dedicated "API Platform Status Page" -> status.bijira.dev (H) | None in docs. status.devant.dev resolves (M) | status.moesif.com in docs footer (H link, M content) |

## Per-topic notes

**What WSO2 Cloud is.** No product docs define WSO2 Cloud as a family. IntP is the only one that uses the term, and uses it for itself (titles like "WSO2 Cloud - Integration Platform", "Sign up for WSO2 Cloud", "WSO2 Cloud support" linked to devant-support@). This **contradicts CONTEXT.md** (WSO2 Cloud = the family, not one product). Sources: https://github.com/wso2/docs-integrator/blob/main/en/docs/manage/cloud/overview.md (updated 2026-05-15), https://github.com/wso2/docs-integrator/blob/main/en/docs/get-started/setup/sign-up-sign-in.md (updated 2026-05-18) (H).

**How products fit together.** Only point-to-point mentions. AM gateway built on APIP (https://github.com/wso2/docs-agent-platform/blob/main/versioned_docs/version-cloud/concepts/gateway.mdx, H). APIP docs home lists Moesif as part of Cloud (https://wso2.com/api-platform/docs/ source `en/docs/index.md`, last_updated 2026-08-09, H); Moesif Basic "at no additional expense under your current WSO2 subscription" (`en/docs/analytics/overview.md`, last_updated 2026-07-03, H). IntP: "When you create an organization in WSO2 Cloud, the platform provisions an organization with the same name in Asgardeo" (`en/docs/manage/cloud/users-and-access/configure-enterprise-login.md`, H). Former names (Asgardeo, Bijira, Devant, Choreo groups "Choreo Platform Engineer", "Choreo DevOps" in APIP org page) appear throughout.

**Sign-up and organizations.** Four separate sign-up flows and four org models. Contradictions:
- APIP: "A user can only create one organization, but may be invited to join others" (`en/docs/cloud/bijira-concepts/organization.md`, last_updated 2026-06-23, H) vs IdP-Plat: account owner "can create multiple root organizations" (`en/asgardeo/docs/guides/your-identity-platform/index.md`, updated 2026-09-11, H).
- AM: orgs "managed by OpenChoreo" (`concepts/organization.mdx`, updated 2026-09-24, H). Moesif org = subscription with one fixed region (https://www.moesif.com/docs/platform/organizations-and-team/, Last Updated 2026-02-18, H).
- APIP and IntP share near-identical org text (isolation, invite to cross) and sign-in providers (Google/GitHub/Microsoft), suggesting one shared control plane, but neither says so.

**Users and access / enterprise login.** APIP and IntP enterprise login pages are **near-verbatim duplicates** (same "Stark Industries" sample email, same DNS TXT `wso2-domain-verification:`), differing only in help address (bijira-help@ vs devant-help@) and IntP adding Asgardeo federation steps. APIP: `en/docs/cloud/administer/configure-enterprise-login/configure-enterprise-login.md` (last_updated 2026-06-23, H). IntP: as above (updated 2026-05-14, H). IdP-Plat is self-service in Console (`en/asgardeo/docs/guides/users/configure-enterprise-login.md`, updated 2026-07-10, H). AM has four predefined roles and `amp:` scopes, no enterprise-login doc (H). Moesif SSO requires Enterprise plan (https://www.moesif.com/docs/platform/saml/, H). Role names differ per product (AM Admin/Developer/AI Lead/Platform Engineer; APIP Admin/API Publisher/API Subscriber/Choreo roles; Moesif admin/member/read-only/dashboard-viewer).

**Billing and subscriptions.** Only IdP-Plat (account subscription) and IntP (platform-service charges) document billing, and they cover different things. IdP-Plat: free tier, monthly/annual, MAU overage monthly, downgrade via asgardeo-help@wso2.com (`en/asgardeo/docs/references/operational-policies.md` sec. 7, updated 2026-09-26, H). IntP: hourly billing for DBs/Kafka "as part of your existing subscription", free plan 5 integrations (`en/docs/manage/cloud/billing/pricing-and-plans.md`, updated 2026-09-09, H). IntP "Usage Dashboards" sits under Billing but is API traffic analytics, not billing (H). APIP has no customer-billing page; its "Subscription Plans" are for API consumers (H). Term "subscription" is overloaded across products.

**Regions and data residency.** Region sets differ and are documented differently:
- IdP-Plat: US and EU with named data centres (`en/asgardeo/docs/references/data-residency-in-identity-platform.md`, updated 2026-09-11, H); duplicated inside ops policies sec. 3 (H).
- IntP: "US and EU regions across all providers" for DBs, but Kafka adds Australia (`platform-services/managed-databases.md`, `managed-message-brokers.md`, H). Its data residency page covers only logs/metrics (`audit/compliance-data-residency.md`, updated 2026-05-14, H).
- APIP: no list, just "multiple cloud regions" (`cloud/api-platform-gateway/cloud-gateway.md`, H).
- Moesif: "Global" plus EU (Azure West Europe), not US/EU (https://www.moesif.com/docs/platform/data-residency/, Last Updated 2026-09-16, H). Moesif security page says data centres are US-based Azure (H).
- AM: nothing.

**SLA.** Only IdP-Plat states a number (99.99%, ops policies sec. 9, H). The 99.99% "WSO2 Cloud" marketing claim from file 00 is not backed by any other product's docs.

**Security and compliance.** No shared trust page in any product docs. Moesif is the only one citing attestations (SOC 2 Type 2, ISO via Azure) (https://www.moesif.com/security, H). IntP and IdP-Plat each have partial policy content (encryption, DSAR, pen-test rules). "Compliance" in APIP means API governance, a naming collision (`cloud/monitoring-and-insights/compliance.md`, H).

**Support.** Five different channels: GitHub (AM), cloud-support.wso2.com + asgardeo support policy (IdP-Plat), bijira-help@ (APIP), devant-support@ and devant-help@ (IntP), support@moesif.com (Moesif). IdP-Plat nav "Enterprise Support" points to a pricing page (`en/asgardeo/mkdocs.yml`, H). No product says whether cloud-support.wso2.com serves all products.

**Status.** Four status hosts, each per former brand (status.asgardeo.io, status.bijira.dev, status.devant.dev, status.moesif.com), all return HTTP 200 with a JS "Status Page" shell (M for contents). Only APIP has a dedicated docs page; IntP and AM docs link none.

## Open questions

1. Is "WSO2 Cloud" the account/sign-up name shared by APIP and IntP (one control plane, console.bijira.dev and console.devant.dev), or only IntP's branding? Does AM sit on the same account?
2. Does one WSO2 Cloud subscription cover multiple products? IntP and Moesif Basic text implies a shared "WSO2 subscription"; IdP-Plat billing is separate (own portal, Azure Marketplace).
3. Authoritative region list per product (APIP and AM undocumented; Moesif "Global" vs others "US").
4. Is cloud-support.wso2.com the single support portal for all five? Which help addresses are current?
5. Does the 99.99% SLA apply beyond Identity Platform? Is there a WSO2 Cloud SLA document?
6. Is there a WSO2-wide trust/compliance page (wso2.com/security/ returned 403 to automated fetch; not verified)?
7. Should status be unified, or should the hub list the four status pages?
8. Is APIP's "one organization per user" rule current, given IdP-Plat allows many root orgs?
