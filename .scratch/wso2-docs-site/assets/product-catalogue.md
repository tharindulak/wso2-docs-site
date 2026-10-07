# Product catalogue (revised 2026-10-07)

Covers every doc set on wso2.com/documentation (user decision 2026-10-07; see [Coverage check](documentation-coverage.md)). **One entry per product**: cloud and self-hosted content live in the same product, distinguished only by the page's deployment-option label; never a separate "SaaS"/"Open source" entry or "Cloud" section. Product-team confirmation pending in [Confirm the product catalogue with product teams](../issues/05-confirm-product-catalogue.md).

Groups follow wso2.com/documentation. "Migrated" = content pulled into the docs site; the rest link out to their current site until migrated.

| Group | Product | WSO2 Cloud content source | Self-hosted content source | Status |
|---|---|---|---|---|
| Agent Management | Agent Manager | docs-agent-platform | docs-agent-platform | Link out |
| API Management | API Platform | docs-api-platform (published as Bijira) | docs-apim (API Manager) | Link out |
| API Management | Kubernetes Gateway | | docs-apk | Link out |
| API Management | API Analytics Platform | moesif.com (stays external) | | Link out |
| Integration | Integration Platform | docs-devant (Devant) | docs-integrator (WSO2 Integrator), docs-mi (Micro Integrator), docs-bi (BI), docs-si (SI), docs-icp (ICP) | Skeleton |
| Identity and Access Management | Identity Platform | docs-is `en/asgardeo` | docs-is `en/identity-server` (Identity Server) | Skeleton |
| Internal Developer Platform | Developer Platform | docs-choreo-dev (for Developers, for Platform Engineers) | | Link out |
| Solutions | Accelerator for Healthcare | | open-healthcare-docs | Link out |
| Solutions | Accelerator for Financial Services | | docs-open-banking (+ ob-toolkit repos) | Link out |
| Other | Updates | | docs-updates | Link out |
| Other | Platform Security | | docs-security | Link out |

Within a product, sections follow what readers use (for Integration Platform: WSO2 Integrator, Micro Integrator, …), each self-hosted distribution versioned separately; cloud pages sit inside the section they belong to, labelled "WSO2 Cloud". How two separate source trees combine into one section is open: [Combining separate cloud and self-hosted doc sets](../issues/15-combine-separate-doc-sets.md).
