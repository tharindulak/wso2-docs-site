# Docs site reads Identity Platform from the fork

Parent: [map](../map.md)
Type: task (AFK)
Status: in progress
Assignee: tharinduj
Blocked by: 09

## Question

On a Wso2-Cloud branch, switch the lock file's `identity` entry from `mkdocs-merge` to `docusaurus`, pointed at the fork's working branch SHA, and close the gaps found in [What the docs site's docusaurus source kind needs](01-docusaurus-source-kind.md). Done when a quick build of Identity Platform and its snapshots succeeds, the link check against the existing baselines shows no new breakage, and pages, labels, version selector, redirects and search match the `mkdocs-merge` build. Not merged until upstream accepts the migration. Docs-site work from [Docusaurus tree format decisions](12-tree-format-decisions.md): copy `docusaurus/assets/`, register components globally, strict compile, keep source edit links, read `redirects.json`, check `versions.json` against the lock, run the MDX allow-list plugin in the build, keep `_partials` out of `pages.json`. Also from [Includes as MDX partials in Latest](05-includes-as-partials.md): `<Applies>` hides blocks for deployment options the page does not cover.

## Progress

- 2026-10-13: earlier commits on `docs-is-migrate` closed most gaps (shared assets, static, redirects, strict compile, edit links, global components, `<Applies>` hiding, `versions.json` check, `_partials` out of `pages.json`). This session added: tree writer follows page-URL-relative file links (044e48e), `{{ base_path }}//x` resolves as `{{ base_path }}/x` (affects every product's conversion), tree writer follows a link target on the next line and sends linked `.html` files to `static/`. Fork commit amended each time (local only, not pushed); lock bumped to match.
- All 8 older-version snapshots (7.2.0 to 5.9.0) build and pass their link baselines. Latest quick build passes under strict compile; link check under `identity/`: 31 broken, all in baselines, 0 new. Page set matches `mkdocs-merge` except 40 partials and the upstream OpenID4VP page `verify-vc`.
- Known, pre-existing: duplicate routes `/identity/apis/scim2/` and `/identity/references/token-binding/` (source has both `x.md` and `x/index.md`; same in `mkdocs-merge`).
- Script tests: 4 fail without `DOCS_SITE_TEST_OWNER=tharindulak` because the lock points at the fork (by design, branch only).
- Not done yet: MDX allow-list remark plugin in the build (contract open in [08](08-authored-mdx-contract.md)); label, version selector, redirect and search parity not yet compared by hand.
- 2026-10-13: fork branch `docusaurus-migration` (b5afc08cf) pushed to tharindulak/docs-is; draft PR https://github.com/tharindulak/docs-is/pull/1 (early review copy; ticket 11 still owns the ready PR). Wso2-Cloud branch `docs-is-migrate` not pushed.
