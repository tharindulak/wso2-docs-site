# Choose the Latest source for each section

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

For every self-hosted section in `content-sources.yaml`, which ref holds the Latest docs, and what rule decides it? Today each section tracks `main` or `master`, but that means different things per repo: Kubernetes Gateway's main is labelled 1.2.0 while released 1.3.0 docs sit on branch `1.3.0`; Micro Integrator's main says 4.7.0 with no release; WSO2 Integrator's `5.1.x` is ahead of main. Decide the rule (newest GA release's branch or folder, or the default branch), fix the stale sections, and say how Latest is labelled when docs run ahead of a release.

## Answer

Decided with the user, 2026-10-09 (recommendations accepted).

- **Rule:** Latest is the docs for the newest GA release. Once a section adopts the [docs-release convention](05-docs-release-convention.md), that is its newest GA docs release. Until then, it is the release branch or version folder of the newest GA product release, never the default branch by assumption.
- **Unreleased docs** (Micro Integrator main labelled 4.7.0, WSO2 Integrator `5.1.x`, Identity Server `next`) do not appear on the site. Teams preview them with the local override.
- **Fixes after release:** Latest keeps following them. `track` is the release branch (for example `4.7.0` in docs-apim). For folder-based repos it is the default branch restricted to the version's folder. Under the convention, a patch docs release replaces this.
- **Labels** come from the lock file, never from the docs' own `site_name` or `site_version`.
- **Single-version sections** (BI, WSO2 Integrator, Healthcare, Updates, Platform Security) keep tracking their default branch, labelled "Latest" with no number, until they adopt the convention.
- **Kubernetes Gateway:** Latest is 1.3.0 from branch `1.3.0`. 2.0.0 is left off, because it appears to be API Platform's API Gateway.
- **Financial Services:** keep the `master` pin until the team confirms which ref is live.
- Both of those are confirmed in [Confirm live refs with product teams](09-confirm-live-refs.md). They do not block other tickets.
- **Lock file changes this implies:**
  - Kubernetes Gateway moves to branch `1.3.0`.
  - Micro Integrator moves to branch `4.6.0` (labelled 4.6.0, so the `note` that keeps its version label off can go).
  - API Manager moves to branch `4.7.0`.
  - Streaming Integrator moves to branch `4.4.0`.

  These changes land with the schema from [Lock file schema for many versions per section](06-lock-file-schema.md) or as a standalone lock-file PR, whichever comes first.
