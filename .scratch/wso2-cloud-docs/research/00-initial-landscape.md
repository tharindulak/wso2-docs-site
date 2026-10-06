# Initial landscape: WSO2 Cloud product docs (as of 2026-10-02)

Gathered while charting the map. H = fetched/verified, M = search result only.

| Product | Former name | Docs root | Cloud console | Tooling / source |
|---|---|---|---|---|
| Agent Manager | (new, GA Sep 2026, tag amp/v1.0.0 2026-09-07) | https://wso2.com/agent-platform/docs/ ("Cloud" version tab) (H) | console.agent-manager.cloud.wso2.com (H) | Docusaurus, github.com/wso2/docs-agent-platform |
| Identity Platform | Asgardeo | https://wso2.com/identity-platform/docs/ (asgardeo/docs 301s here) (H) | console.asgardeo.io (H) | MkDocs Material, github.com/wso2/docs-is `en/asgardeo/` |
| API Platform | Bijira | https://wso2.com/api-platform/docs/ (bijira/docs 301s here; cloud + self-hosted mixed) (H) | console.bijira.dev (H); status.bijira.dev (M) | MkDocs, github.com/wso2/docs-api-platform |
| Integration Platform | Devant | https://wso2.com/integration-platform/docs/ , cloud under Manage > Cloud (devant/docs 301s here) (H) | console.devant.dev (H) | Docusaurus, github.com/wso2/docs-integrator (docs-devant looks superseded) |
| API Analytics Platform | Moesif (WSO2 subsidiary) | https://www.moesif.com/docs/ (Moesif-branded) (H); "Moesif Basic" inside API Platform docs (M) | not found | unknown |

On-prem docs: Identity Server https://is.docs.wso2.com/ , API Manager https://apim.docs.wso2.com/ , Integrator self-hosted within integration-platform/docs.

## Umbrella / shared

- "WSO2 Cloud" appears only as a marketing label ("fully managed SaaS", 99.99% SLA, multi-region, data sovereignty option; marketing claims, unverified).
- No umbrella docs or console. console.wso2.com did not resolve. https://wso2.com/documentation lists products separately and still labels the API SaaS "Bijira".
- Shared topics live per product: org/users/enterprise login in each; Billing only in Integration Cloud docs; status page only status.bijira.dev; security at wso2.com/security/ and security.docs.wso2.com; subscriptions at wso2.com/subscription/. No consolidated regions/data residency or trust page found.

## Gaps noticed

- Rebrand partial: consoles, URL slugs and the docs hub still use former names.
- Agent Manager product page links a dead docs path (wso2.github.io/agent-manager/docs/v1.0.0/..., 404).
