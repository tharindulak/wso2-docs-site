# Where cross-cutting topics live today across the five product docs

Parent: [map](../map.md)
Type: research
Status: resolved
Blocked by:

## Question

For each cross-cutting topic (what WSO2 Cloud is, how products fit together, sign-up and organizations, users and access / enterprise login, billing and subscriptions, regions and data residency, SLA, security and compliance, support, status), where is it documented today in each of the five products' docs (Agent Manager, Identity Platform, API Platform, Integration Platform, API Analytics Platform/Moesif)? Note URL, what it says, last-updated signal, and where products duplicate or contradict each other. Output a topic x product matrix.

Research: [findings](../research/01-cross-cutting-topics-today.md)

## Answer

Every cross-cutting topic is documented per product, with no shared layer; see [findings](../research/01-cross-cutting-topics-today.md) for the matrix and sources. Key facts later tickets depend on:

- No product docs define "WSO2 Cloud" as the product family; Integration Platform uses "WSO2 Cloud" as its own name and sign-up label.
- Contradictions: organizations (API Platform one per user vs Identity Platform many root orgs); regions (Identity US/EU, Integration US/EU plus Australia for Kafka, Moesif Global/EU, API Platform and Agent Manager undocumented).
- Duplication: API Platform and Integration Platform enterprise-login pages are near copies.
- Billing documented only by Identity and Integration; "subscription" means different things per product.
- SLA (99.99%) stated only by Identity Platform; no shared trust/compliance page (only Moesif cites SOC 2/ISO).
- Five support channels; four status pages under former brands.
- Agent Manager docs cover almost none of these topics.
- Unverified (blocked fetch): wso2.com/security/, wso2.com/cloud/, cloud-support.wso2.com; status page contents.
