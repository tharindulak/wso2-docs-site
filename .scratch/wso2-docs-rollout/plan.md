# WSO2 docs site rollout plan

As of 2026-10-14. Detail lives in the [rollout map](map.md) and its tickets.

## Goal

One WSO2 docs site on Docusaurus that brings every product together, with version switching, cross-product search and AI-friendly output. Each product's docs repo publishes versioned docs bundles; the site pulls and builds them.

- **By WSO2Con (20 Nov 2026):** the plan, the bundle pipeline, and Identity Platform running end to end through it.
- **After WSO2Con:** every other product adopts bundles, then migrates to Docusaurus in an agreed order.

## How it works

1. A writer merges docs changes in the product's docs repo.
2. **Self-hosted release:** the writer runs "Publish docs release" with a version (for example `7.3.0`). The shared workflow checks the content, builds a bundle, attests it and publishes a GitHub Release `v7.3.0` with the bundle attached.
3. **WSO2 Cloud content:** a push that touches cloud docs publishes a new rolling Latest bundle automatically (`cloud/2026.10.14.1`).
4. The docs site's bot finds new bundles every hour and opens a PR that pins each bundle's checksum in the lock file.
5. The site verifies the checksum and attestation, checks the content, and builds. Unmigrated products' MkDocs is converted during this build.
6. Cloud updates and docs fixes merge automatically once the build passes. A new product version needs one docs-team approval.

## Where things stand

| Workstream | Status | Notes |
| --- | --- | --- |
| MkDocs to Docusaurus converter | Done | 92% of 6,617 Latest pages and 99.8% of older-version pages convert cleanly |
| Per-product version numbers | Done | One version list per product; WSO2 Cloud is Latest only |
| Version switching | Built in pilot | Selector design for many versions still open |
| Identity Platform migration | In progress | Docusaurus tree generated on a fork (6,568 pages); duplicates, failing pages and the fork PR remain |
| Content components (element list) | Mostly built | Built for Identity Platform; docs-team reviews open |
| Site build and aggregation | Built, not merged | Every product's released versions served on a branch; pilot sign-off open |
| Cross-site search | Behaviour decided | Production engine undecided; Algolia legal review on hold |
| Release pipeline (bundles) | Decided | Spec and workflow design done; nothing built; no product uses it yet |
| AI-friendly docs | Decided | Spec done; nothing built |
| Other products' migrations | Not started | Order and owners not yet set |

## Key decisions

- **Every product ships docs bundles.** A bundle is one tar.gz per version of one product section. It holds source only (MkDocs or MDX) plus its images and a manifest.
- **Migration has no forced deadline.** Every product moves to Docusaurus eventually, Identity Platform first. Until then, its bundle carries raw MkDocs and the site converts it.
- **Two kinds of bundle.** Self-hosted releases get a release bundle (`v7.3.0`). WSO2 Cloud content gets a rolling Latest bundle, republished when cloud docs change.
- **Writers release with one workflow.** They run "Publish docs release" in their repo. It checks the content, then creates the tag, bundle and release in one go.
- **The site pulls; products never push.** A lock file pins each bundle's checksum. The site accepts only bundles built by the shared workflow, and it rejects unsafe content.
- **Approvals.** Cloud updates and docs fixes merge automatically once the site build passes. A new product version needs one docs-team approval.
- **AI-friendly docs.** Every page gets a `.md` version, a "Copy page" button and a "View as Markdown" link. The site also gets `llms.txt` files per product and version. "Open in ChatGPT/Claude" links are left out pending a privacy review.
- **Older versions** already on the current sites stay as frozen builds. Bundles start from each product's next release.

## Phases

The critical path runs through finishing the Identity Platform fork PR and naming owners for each product.

1. **Identity Platform end to end (before WSO2Con).** Finish the fork PR. Build the shared release workflow and bundle intake. Publish Identity Platform's first bundle and build the site from it. Add AI-friendly output.
    - Waits on: duplicates and failing pages fixed on the fork; a sandbox test of the release workflow (on hold).
2. **Plan the rollout.** Set the criteria and order for migrating the other products, using the Identity Platform migration as the recipe. Name an owner for each product.
    - Waits on: phase 1's fork PR; the list of people involved.
3. **Product teams sign up.** Each team agrees to publish bundles and to its migration slot and cutover checklist.
    - Waits on: phase 2.
4. **Schedule.** Set dates for every product adopting bundles and migrating, and decide what slips first if time runs short.
5. **Products adopt bundles, then migrate**, in the agreed order.

### Next steps

- [ ] Finish the Identity Platform fork PR
- [ ] Name the docs owner for each product
- [ ] Get a decision on AI crawler access in robots.txt from the wso2.com policy owner
- [ ] Run the sandbox test of the release workflow (on hold)
- [ ] Rewrite the contributor release guide for "Publish docs release"

## Risks and approvals

- **Security gap today:** Docusaurus-format content gets no HTML or MDX allow-list, and `.js`/`.ts` sidebars run during the build. Both must be fixed before the site accepts bundles. Needs a security review.
- **Unverified GitHub behaviour:** three release-workflow mechanics are untested (signer identity when pinned by SHA, draft tag timing, rulesets on API-created releases). The design depends on them.
- **Team buy-in:** each product team must agree to publish bundles and, later, to its migration and cutover.
- **Schedule:** six weeks to WSO2Con, alongside the open Identity Platform work.
- **Known loss:** Agent Manager readers lose "Open in ChatGPT/Claude/Perplexity" links.
- **Needs approval:** the AI crawler policy (marketing or legal), and production search engine choice (Algolia legal review on hold).
- **Out of scope:** hosting and domain, retiring the current docs sites and redirects, writing new content.
