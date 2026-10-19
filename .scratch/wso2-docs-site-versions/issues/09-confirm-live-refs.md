# Confirm live refs with product teams

Parent: [map](../map.md)
Type: task (HITL)
Status: closed
Assignee:
Blocked by:

## Question

Ask the owning product teams, and record their answers:
1. **API team:** Is Kubernetes Gateway 2.0.0 (`apk.docs.wso2.com/en/2.0.0/`, branch `2.0.0` in docs-apk, no GA release in wso2/apk) now API Platform's API Gateway, so the Kubernetes Gateway section ends at 1.3.0?
2. **API team:** The `apim-*` and component branches in docs-api-platform install `docs-shared-hooks` from a personal fork. When will it move to a WSO2 repo?
3. **Open Banking team:** Which ref is live for Financial Services 4.0.0: `4.0.0`, `v4.0.0` or `master`? Do v4.1.0 and v4.1.1 need docs versions?
4. **Micro Integrator team:** Is 4.7.0 an upcoming release, and when?

## Partial answers (2026-10-11)

- Q1: the user chose Kubernetes Gateway Latest = branch `1.3.0`, 2.0.0 out ([Rollout order and cut line](13-rollout-order-and-cut-line.md)); the API team has not been asked.
- Q3: the live site serves `master` (browser check); v4.1.x docs not asked.
- Q2 and Q4 still open.

## Answer (2026-10-11, the user accepted all recommendations)

1. Kubernetes Gateway ends at 1.3.0; 2.0.0 is treated as API Platform's API Gateway and stays out.
2. Until the API team moves `docs-shared-hooks` to a WSO2 repo, API Manager is read from `wso2/docs-apim` and API Platform components from the version folders on `docs-api-platform` main, never from the `apim-*` or component branches.
3. Open Banking 4.0.0 docs cover v4.1.0 and v4.1.1; no new versions. Latest is `master` (browser check).
4. Micro Integrator Latest moves from `main` (labelled 4.7.0, unreleased) to branch `4.6.0` until 4.7.0 GA.
5. API Manager Latest moves from `master` to branch `4.7.0`.
6. BI's `docs-1.x` branches stay unpublished.
7. WSO2 Integrator `5.0.x` becomes an older version only when 5.1 ships, through a docs release.
8. Enterprise Integrator 7.x docs (Micro Integrator 1.x) are linked under Micro Integrator's Older versions to `ei.docs.wso2.com`, not converted.

The product teams were not asked; these are the user's decisions. Revisit Q2 and Q4 with the API and MI teams.
