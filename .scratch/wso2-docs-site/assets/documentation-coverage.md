# wso2.com/documentation vs the navigation prototype (checked 2026-10-07)

Source: wso2.com/documentation rendered in headless Chrome (links are built with JavaScript). Repo for each site confirmed from its config (`site_url` / `baseUrl`). Prototype: http://localhost:3011 (branch `prototype/navigation`).

| wso2.com group | Doc set (URL) | Content source | Map scope | In prototype |
|---|---|---|---|---|
| Agent Management | WSO2 Agent Manager (wso2.com/agent-platform/docs/v1.0.0/) | docs-agent-platform | In (not in skeleton) | Missing: menu entry "soon" only |
| API Management, open source | WSO2 API Manager (apim.docs.wso2.com) | docs-apim | In: API Platform self-hosted (not in skeleton) | Missing: "soon" only |
| API Management, open source | WSO2 Kubernetes Gateway (apk.docs.wso2.com) | docs-apk | Later | Missing |
| API Management, SaaS | Bijira (wso2.com/bijira/docs/) | docs-api-platform | In: API Platform cloud (not in skeleton) | Missing: "soon" only |
| Integration | WSO2 Integration Platform (wso2.com/integration-platform/docs/) | docs-integrator | In: skeleton | Placeholder ("WSO2 Integrator" tab) |
| Integration | WSO2 Integrator: BI (bi.docs.wso2.com) | docs-bi | In (catalogue) | Missing: no tab |
| Integration | WSO2 Integrator: SI (si.docs.wso2.com) | docs-si | Later | Missing |
| Integration, SaaS | Devant (wso2.com/devant/docs/) | docs-devant | In: skeleton | Placeholder ("Cloud" tab) |
| EIP guides | EIP with WSO2 Integrator: MI (mi.docs.wso2.com/…/eip-overview/) | docs-mi | In: skeleton | Placeholder ("Micro Integrator" tab; no EIP guide) |
| EIP guides | EIP with WSO2 Integrator: BI (bi.docs.wso2.com/references/…) | docs-bi | In (catalogue) | Missing |
| Identity and Access Management, open source | WSO2 Identity Server (is.docs.wso2.com) | docs-is (en/identity-server) | In: skeleton | Real, merged with Identity Platform (Latest 7.3.0, 7.2.0 and 7.1.0 subsets) |
| Identity and Access Management, SaaS | WSO2 Identity Platform (wso2.com/identity-platform/docs/) | docs-is (en/asgardeo) | In: skeleton | Real, merged |
| Internal Developer Platform, SaaS | WSO2 Developer Platform for Developers (wso2.com/engineering-platform/…/developer/) | docs-choreo-dev | Out (old map) | Missing |
| Internal Developer Platform, SaaS | WSO2 Developer Platform for Platform Engineers (…/platform-engineer/) | docs-choreo-dev | Out (old map) | Missing |
| Solutions, open source | WSO2 Accelerator for Healthcare (healthcare.docs.wso2.com) | open-healthcare-docs | Not considered | Missing |
| Solutions, open source | WSO2 Accelerator for Financial Services (ob.docs.wso2.com) | docs-open-banking | Not considered | Missing |
| Other, open source | WSO2 Updates (updates.docs.wso2.com) | docs-updates | Not considered | Missing |
| Other, open source | WSO2 Platform Security (security.docs.wso2.com) | docs-security | Not considered | Missing |

Not on wso2.com/documentation but in the map: API Analytics Platform (Moesif docs at moesif.com), WSO2 Cloud hub pages (new), ICP (docs-icp).

## Identity Platform coverage inside the prototype

1,024 Latest pages from docs-is: 871 published, 142 excluded (MDX compile errors from invalid HTML in the source), 8 failed to convert, 3 not rendered. About 15% of Identity pages are missing until the source HTML is fixed (see [Build-time conversion contract](../issues/13-conversion-contract.md) exclude list). Older versions 7.2.0 and 7.1.0 hold a 4-page sample only.

## Corrections to the product catalogue

- API Platform cloud docs are published as **Bijira** (docs-api-platform, site_url wso2.com/bijira/docs). Former name still used on wso2.com.
- "WSO2 Integration Platform" on wso2.com is **docs-integrator** (BASE_URL /integration-platform/docs/), not a separate umbrella page.
- Micro Integrator's main docs are not linked from wso2.com/documentation, only its EIP guide.
- API Analytics Platform (Moesif) is not listed on wso2.com/documentation.
