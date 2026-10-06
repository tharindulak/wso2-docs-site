# Gap audit for each product's docs

Parent: [map](../map.md)
Type: research
Status: resolved
Blocked by:

## Question

For each of the five products, what gaps would hurt a primary reader landing from the hub? Check: a cloud-specific getting-started path (sign-up to first working result), broken or outdated inbound links (e.g. product pages to docs), stale former names in visible text, clarity of SaaS vs hybrid vs self-hosted content, existing cross-product links, and freshness (last updated). Output one gap list per product with URL evidence and a severity (blocker / notable / minor).

Research: [findings](../research/02-product-gap-audit.md)

## Answer

Per-product gap tables with URL evidence and severity are in [findings](../research/02-product-gap-audit.md). Headline gaps:

- Blockers: Agent Manager product page "View the docs" 404s; wso2.com/api-analytics-platform/ 404s and wso2.com/documentation omits Moesif, links Agent Manager to self-hosted v1.0.0 and still says "Bijira".
- Sign-up and consoles still on former-name domains (asgardeo.io, console.bijira.dev, console.devant.dev); only Agent Manager is on a WSO2 Cloud domain.
- Cloud getting-started weak in Agent Manager (self-hosted default), Integration Platform (cloud buried under Manage > Cloud) and Moesif (stale, 2025-02-28). Identity Platform is the model path.
- Integration Platform already calls its console and product "WSO2 Cloud" (naming collision).
- Heavy former-name text in API Platform (~37 Bijira, ~237 Asgardeo) and Integration (~189 "Deploy to Devant"); stale slugs.
- Cross-product links nearly absent, some point to old Asgardeo paths or Choreo; none to Agent Manager.
- Old Devant deep links all land on one overview page; Identity and API Platform show no page dates.

## Comments

- 2026-10-02, user: drop two items from the gap list: the wso2.com/api-analytics-platform/ 404, and all Bijira former-name gaps (docs hub label, "Bijira" text and slugs in API Platform docs). Not carried into the priority order.
