# Combining separate cloud and self-hosted doc sets

Parent: [map](../map.md)
Type: prototype
Status: open
Assignee:
Blocked by: 05

## Question

Identity Platform's cloud and self-hosted docs share one source (docs-is), so the converter merges them page by page. Other products keep them in separate repos: Integration Platform (Devant cloud vs WSO2 Integrator, Micro Integrator and others), API Platform (Bijira vs API Manager). With no separate "Cloud" section (user decision 2026-10-07), how do two independent trees become one product section: which tree sets the sidebar, where cloud-only pages slot in, what happens to topics both trees cover (two pages, or one page with labelled blocks), and how the merged tree behaves on older self-hosted versions (cloud pages absent)? Prototype on Integration Platform (Devant + WSO2 Integrator), then confirm with the Integration team. Also applies to Agent Manager, whose cloud docs are a hand-forked `versioned_docs/version-cloud` beside self-hosted `v1.0.0` (found 2026-10-07).
