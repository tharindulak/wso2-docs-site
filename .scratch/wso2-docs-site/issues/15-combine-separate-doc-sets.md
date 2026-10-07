# Combining separate cloud and self-hosted doc sets

Parent: [map](../map.md)
Type: prototype
Status: built, awaiting Integration team confirmation
Assignee:
Blocked by: 05

## Question

Identity Platform's cloud and self-hosted docs share one source (docs-is), so the converter merges them page by page. Other products keep them in separate repos: Integration Platform (Devant cloud vs WSO2 Integrator, Micro Integrator and others), API Platform (Bijira vs API Manager). With no separate "Cloud" section (user decision 2026-10-07), how do two independent trees become one product section: which tree sets the sidebar, where cloud-only pages slot in, what happens to topics both trees cover (two pages, or one page with labelled blocks), and how the merged tree behaves on older self-hosted versions (cloud pages absent)? Prototype on Integration Platform (Devant + WSO2 Integrator), then confirm with the Integration team.

## Findings (2026-10-07, built in the skeleton, not yet confirmed)

Built on Integration Platform in `docs-site/` (commits 2c0968a, 759eb85); Devant is WSO2 Integrator's WSO2 Cloud deployment option (user decision 2026-10-07).

- **Which tree sets the sidebar:** the self-hosted product's (WSO2 Integrator's `sidebars.ts`). Devant is a `cloud_companion` of that section in `content-sources.yaml`, its pages published under `cloud/`.
- **Where cloud-only pages slot in:** a `placement` map sends each Devant top-level nav section into one WSO2 Integrator section (14 rows; 63 Devant pages land in 7 of 8 sections, none in Connectors). Unmapped sections go at the end. A `rename` map keeps "Devant" out of section labels.
- **Topics both trees cover:** a same-label category (for example Concepts) takes the Devant entries after its own. Overlapping pages stay as two pages, one labelled "WSO2 Cloud"; no page-level merge yet. Open: which overlaps the Integration team wants merged.
- **Labels:** Devant pages "WSO2 Cloud"; WSO2 Integrator pages "WSO2 Cloud, Self-hosted"; its `deploy-operate/deploy/` pages "Self-hosted".
- **Older self-hosted versions:** not exercised; no older WSO2 Integrator version is built yet.
- **Security:** WSO2 Integrator's sidebar is TypeScript evaluated at content-build time, so content bumps run that repo's code in CI. Components the pages import are mapped to site-owned stand-ins, so source-repo code does not reach readers' browsers.

Needs confirmation from the Integration team: the placement map, WSO2 Integrator's default label, and which Micro Integrator release is Latest (docs say 4.7.0, newest GitHub release v4.6.0).
