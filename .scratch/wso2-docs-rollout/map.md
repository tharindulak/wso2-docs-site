# Map: Roll out the WSO2 docs site across all products

Label: wayfinder:map

## Destination

A rollout plan ready to hand off: for every product, whether and when its content source migrates to Docusaurus, how it publishes a versioned **Docs bundle** through a shared release Action, the order and owners of each migration, and dates. The docs site aggregates bundles into one site with version switching, cross-product search and AI-friendly output. By WSO2Con (2026-11-20): the plan, the bundle pipeline, and Identity Platform running end to end through it; other products scheduled after.

## Notes

- Domain: documentation platform. Vocabulary in [CONTEXT.md](../../CONTEXT.md) (Content source, Migration, Cutover, Docs bundle, Self-hosted distribution, Deployment option).
- **Umbrella map.** Decided areas stay on their own maps and are linked, not redone: site and search ([WSO2 docs site on Docusaurus](../wso2-docs-site/map.md)), versions ([All released versions on the WSO2 docs site](../wso2-docs-site-versions/map.md)), Identity Platform pilot ([Migrate Identity Platform docs](../wso2-docs-is-migration/map.md)), components ([Site features and content components](../wso2-docs-elements/map.md), [Writers author with WSO2 content components](../wso2-docs-authoring-components/map.md)). Status of everything at charting: [Baseline status](assets/baseline-status.md).
- Shareable summary of this map: [Rollout plan](plan.md) (2026-10-14); update it when decisions change.
- Planning only: builds happen on the linked maps or after hand-off.
- Standing decisions from charting (user, 2026-10-14):
  - **Every product publishes Docs bundles** through its GitHub Releases; the site's lock file pins and pulls them (product pipelines get no write access to the site). Bundle details: [Docs bundle spec](issues/01-docs-bundle-spec.md).
  - **Every product migrates eventually, with no forced deadline** ([Docs bundle spec](issues/01-docs-bundle-spec.md), clarified in [Shared release Action](issues/03-shared-release-action.md)): Identity Platform now, others ordered by payoff. Until then unmigrated products ship raw MkDocs in their bundles and the site converts them; the converter is short-lived.
  - **One shared release workflow** (a reusable workflow in this repo), owned by the docs-site team, pinned by commit SHA in each content source. Writers cut releases with its "Publish docs release" run, not by publishing a GitHub Release by hand.
  - **Older versions:** bundles start from each team's next release; the 51 existing versions stay site-built frozen snapshots (no backfill).
  - **AI-friendly docs** means `llms.txt`, `llms-full.txt`, a `.md` URL per page and "Copy as Markdown". Docs MCP server and "Open in ChatGPT/Claude" stay candidates pending privacy and security review.
- Skills every session should consult: grilling, domain-modeling. Research tickets use research.
- Security and supply chain: bundles are untrusted input to the site build (checksum, MDX allow-list, archive path traversal); the shared Action is a dependency of every content source.
- Outward-facing: contacting product teams and opening PRs on `wso2/*` repos need the user's go-ahead each time.
- Treat findings as planning input for human review.

## Decisions so far

<!-- one line per closed ticket -->

- [Docs bundle spec](issues/01-docs-bundle-spec.md): one tar.gz per version of one section, source only (raw MkDocs or MDX), self-contained images; SHA-256 pinned in the lock file plus an attestation from the shared Action and immutable releases; strict intake rules; migration has no forced deadline.
- [Cloud Latest without tags](issues/02-cloud-latest-bundles.md): cloud content ships as a rolling Latest bundle, a new prerelease `cloud/<date.n>` release on each push touching cloud paths, auto-merged on a green build; self-hosted keeps `v<version>` release bundles; migrated merged sections prepare the next version on a release branch.
- [AI-friendly docs scope](issues/07-ai-friendly-docs.md): our own MDX-to-Markdown in the converter (deployment options labelled, never filtered); `<page>.md`, nested `llms.txt` per product and version, `llms-full.txt` per product at Latest; every version including snapshots; "Copy page" and "View as Markdown" only (Agent Manager loses its AI links); crawler policy needs approval.
- [Shared release Action](issues/03-shared-release-action.md): a reusable workflow in this repo; writers run "Publish docs release" (validate, tag, draft, attest, publish) because immutable releases forbid attaching later; a read-only check job and a separate write job; converter built from source as a stopgap; tag updates and deletes blocked, attestation is the gate; Dependabot bumps.

## Not yet specified

- Retiring the converter once the last product migrates: what leaves the site and the workflow, and how frozen snapshots built by conversion are kept.
- Sandbox test of the release workflow mechanics (on hold, user 2026-10-14): the signer identity format when callers pin by SHA, whether a draft creates its tag before publish, and whether API release creation is checked against tag rulesets. Must pass before the workflow is built.
- Rewriting `docs-site/CONTENT-RELEASES.md` for "Publish docs release" and bundles.

- Contributor tooling across products: local preview, contributor guide and components chapter generalised from Identity Platform to every content source.
- Serving Markdown on `Accept: text/markdown` and HTTP `Link:` headers: depends on the docs host (hosting set aside).
- Version-scoped search over bundles (snapshots carry version meta tags).
- Building the site from bundles: moving the fetch, snapshot keys and bump bot from git pins to bundle pins, and when the Identity Platform fork switches from its `docusaurus` git pin to bundles.

## Out of scope


- Publishing location and hosting (set aside on the parent map).
- Retiring the current docs sites and redirects from old URLs.
- Writing new content and editorial rewrites.
- Docs MCP server and "Open in ChatGPT/Claude": need privacy and security review first.
