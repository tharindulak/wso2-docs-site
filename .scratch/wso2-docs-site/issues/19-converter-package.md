# Converter as a TypeScript package and CLI

Parent: [map](../map.md)
Type: task (AFK)
Status: open (phase 1 done)
Assignee: tharinduj
Blocked by:

## Question

Make the MkDocs-to-Docusaurus converter a TypeScript npm package with a CLI, so the docs site uses it to convert every product and content repos can run the same conversion themselves (user request, 2026-10-08).

## Phase 1 (done 2026-10-08)

- `docs-site/packages/docs-converter`, published name `@wso2/docs-converter` 0.1.0: strict TypeScript (tsc 7.0.2), compiled to `dist/` with type definitions; 153 dependencies (the site has about 1,400).
- Holds all conversion: Jinja subset, includes, HTML allow-list, MkDocs syntax, cloud/self-hosted merge, Docusaurus sources, sidebars, and the site-level loops moved from `build-content.mjs`.
- CLI `wso2-docs`: `check` (exit 0 / 1 / 2; text, GitHub annotations or JSON) and `convert` (`docs/`, `sidebar.json`, `manifest.json` with contract version 1); config `wso2-docs.yaml` with the lock-file field names; paths confined to the repository.
- The docs site converts every product through it (npm workspaces). The check Action and `npm run check-source` use the CLI.
- Tests: 57 carried over, 11 new; 68 passing. Regression: a full content build is identical to the JavaScript converter (5,941 pages, sidebars, manifest, report, 43,621 files). Real run: Micro Integrator, 875 pages, 21 seconds.
- Branch `docs-converter-package`, fast-forwarded into `docs-site-build` (057686f).

## Phase 2 (after WSO2Con): pilot one team

docs-is runs `wso2-docs check` on pull requests and publishes `wso2-docs convert` output as a release asset; the site gains a `prebuilt` source kind that fetches a pinned artifact, checks its contract version and re-validates it (policy, compile) before use.

## Phase 3: roll out per team

Teams opt in one by one; others stay on build-time conversion.

## Open decisions

- Registry: public npm under `@wso2`, GitHub Packages, or unpublished (used from this repository). Needs WSO2 approval.
- Images in artifacts (size) versus a shared image store.
- Agreement from each product docs team to add the CI step.
