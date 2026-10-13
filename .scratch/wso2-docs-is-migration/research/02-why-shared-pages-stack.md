# 02 Why shared Identity pages render as stacked copies (researched 2026-10-13)

Question: [issues/02-why-shared-pages-stack.md](../issues/02-why-shared-pages-stack.md). Parent: [map](../map.md). Original count: [Content format for content sources](../../wso2-docs-site/issues/06-content-format.md) (119).

Sources (primary only):

- docs-is at the lock-file SHA `c2176fcd1b501d78b6261b04f276f8a9902aabbd` (`docs-site/content-sources.yaml`, Identity section), read from the cached checkout `docs-site/.cache/sources/wso2__docs-is@c2176fcd1b50`. Sides: `en/asgardeo/mkdocs.yml` (WSO2 Cloud) and `en/identity-server/7.3.0/mkdocs.yml` (Self-hosted).
- The converter in the main checkout, `docs-site/packages/docs-converter/src/` (`merge.ts`, `render.ts`, `template.ts`, `site.ts`), compiled unchanged into a scratch copy and called directly. Nothing in the main checkout was modified.

Claims marked **[inference]** are my reasoning, not something a source states.

## TL;DR

- **Recount: 93 shared pages stack today, not 119.** 525 shared paths: 430 merge node by node, 93 stack, 2 fail to convert (both already in the lock file's `exclude` list, so they are missing rather than stacked).
- **The 26-page drop is a converter change, not a docs-is change** (same SHA as the prototype). `splitPageData` in `render.ts` now strips YAML front matter and the quick-start `<script>const meta = …</script>` before the wrappers are compared. Exactly 26 shared pages differ only there (all 11 `quick-starts/*`, plus pages such as `guides/authentication/social-login/index.md`). 93 + 26 = 119.
- **What decides "stack".** `mergePage` (`merge.ts`) compares the two wrapper pages' top-level *shape*: the sequence of include targets, trimmed text, `{% if %}` trees and `{{ var }}` names, ignoring `{% set %}` nodes. Any difference at all, even one line of wrapper prose beside an identical include, falls back to two whole labelled copies (`stats.diverged = true`).
- **`{% set %}` blocks cause none of the 93.** `shape()` filters out `set` nodes, and `mergePage` applies each side's sets to its own environment before merging (`applySets`). Differing sets only show up as `<DeploymentValue>` pairs or `<Applies>` blocks inside merged pages.
- **Converter changes can clear 49 of 93** (32 API reference pages, 17 by include alignment). **The other 44 need a rewrite of the MkDocs source**: 22 wrapper rewrites onto an include that already exists, 21 consolidations of two inline pages, and 1 consolidation of two different include files.

| Cause | Pages | Makes it merge | Examples |
|---|---|---|---|
| A. API reference page, one OpenAPI spec file per product | 32 | **Converter**, plus the `ApiReference` component taking one spec per deployment option | `apis/action-management-rest-api.md`, `apis/idp.md` |
| B. Same include on both sides, the wrapper prose around it differs | 16 | **Converter**: align wrappers on their includes (prototyped, 16/16 merge) | `complete-guides/react/prerequisite.md`, `complete-guides/dotnet/add-login-and-logout.md` |
| C. Both sides wrap includes, but different include files | 2 | 1 **converter** (same alignment, prototyped), 1 **source rewrite** (consolidate two includes) | `guides/branding/localization.md` (converter), `guides/user-self-service/configure-self-service-portal.md` (rewrite) |
| D. One side wraps a shared include, the other has an inline copy that has drifted | 22 | **Wrapper rewrite**: point the inline side at the include after porting its differences into the include as conditionals | `get-started/try-samples/qsg-oidc-webapp-java-ee.md`, `guides/account-configurations/index.md` |
| E. Both sides are inline pages with no shared include (heading and structure drift) | 21 | **Source rewrite**: new shared include with conditionals. A converter block-diff fallback is possible for the near-identical ones, but not recommended as the default | `guides/users/manage-users.md`, `get-started/try-your-own-app/react.md` |
| F. Different `{% set %}` blocks alone | 0 | n/a | none |
| Converter failures (not stacked: excluded) | 2 | Converter (ticket 06) | `guides/organization-management/manage-organizations.md` (block `{% set %}`), `guides/users/attributes/configure-multi-valued-contact-attributes.md` (inline `if … else`) |

The full per-page list is in [Appendix: all 93 pages](#appendix-all-93-pages).

## How the converter decides to stack

`mergePage` in `merge.ts`:

1. Loads each wrapper with `loadPage` (`render.ts`). This expands `{! !}` and `--8<--` markers, strips front matter and quick-start meta (`splitPageData`), and parses the Jinja subset (`template.ts`).
2. Applies each side's top-level `{% set %}` values to that side's environment.
3. Compares `shape(cloud)` with `shape(self)`. `shape` drops `set` nodes and whitespace-only text. It maps an include to its **resolved** path, so `../../../../includes/x.md` and `../../../../../includes/x.md` compare equal. Text is compared trimmed, `if` nodes by their whole branch tree, and vars by expression.
4. If the shapes are equal it merges node by node (`renderMerged`), descending into includes. Otherwise it emits `<Applies to="WSO2 Cloud">` (whole cloud page) followed by `<Applies to="Self-hosted">` (whole self-hosted page). That is the "stacked copy".

So the comparison is all-or-nothing at the wrapper level. It has no notion of "these parts match, those don't".

## Method

- Ran `mergePage` on every path present in both `docs_dir`s (Asgardeo 698 pages, IS 7.3.0 851, shared 525). Used the same environment the build uses (`extra` + `config` + `base_path`) and `shared_names: {product_name: WSO2 Identity Platform}` from the lock file. Recorded `stats.diverged`.
- For each stacked page, rendered both sides the way MkDocs does (`renderSingle`), split the output into Markdown blocks (blank-line separated), normalised hard-coded product names, and measured shared blocks and the number of differing runs (Python `difflib`).
- Checked the 32 `redoc` pages by resolving each side's `spec-url` to its file and comparing the bytes.
- Prototyped include alignment in a scratch copy of `merge.ts` (below) and re-ran the full count.

## A. API reference pages: 32 (converter)

Every one uses `template: templates/redoc.html` with a `<redoc spec-url=…>`. Cloud uses `{{base_path}}/apis/restapis/<x>.yaml` and self-hosted uses `../../apis/restapis/<x>.yaml`. Some also differ in a `theme='{{redoc_theme}}'` attribute.

- 31 of 32 point at **different spec files with different content**: Asgardeo's `en/asgardeo/docs/apis/...yaml` vs IS's `en/identity-server/7.3.0/docs/apis/...yaml`. They differ in `servers` (`api.asgardeo.io/t/{organization-name}` vs `{server-url}` defaulting to `localhost:9443`), auth (bearer vs basic), product names in titles, and sample requests. For example, `actions.yaml` differs on 120 of ~1,690 lines and `idp.yaml` on 1,547 of 4,290.
- 1 page (`apis/organization-apis/rule-metadata-rest-api.md`) points at byte-identical specs and stacks only because the URL is written two ways.
- Today the generated page is two `<ApiReference>` components, each in an `<Applies>` block (`generated/docs/identity/apis/action-management-rest-api.md`).

Fix: **converter**. When both sides are API reference pages, emit one page with one `ApiReference` that carries a spec per deployment option (a switch or tabs), or a single spec when the resolved files are identical. This also needs the docs-site `ApiReference` component to accept two specs. **[inference]** A wrapper rewrite cannot make these merge. The specs really differ, and unifying the OpenAPI files is product work outside this map.

Examples: `apis/action-management-rest-api.md`, `apis/idp.md`.

## B. Same include, differing wrapper prose: 16 (converter)

All under `complete-guides/*` (`prerequisite(s).md`, `register-an-application.md`, `add-login-and-logout.md` for angular, app-native, dotnet, expressjs, javascript, nextjs, react). Both wrappers include the same `en/includes/complete-guides/<x>/<page>.md`, but a few lines of wrapper text before or after it differ. Typical differences are the prerequisites list ("WSO2 Identity Platform account" vs "WSO2 Identity Server setup"), the `heading:` line, or a self-hosted-only tip about the self-signed certificate after the include.

Rendered pages share 31% to 96% of their Markdown blocks, with 1 to 3 differing runs.

**Prototype (scratch only, not committed).** In the divergent branch of `mergePage`, align the two wrappers' top-level nodes by longest common subsequence of their shape keys. Merge matching nodes (the shared include) with `renderMerged`. Emit only the unmatched runs as `<Applies>` blocks. Enable it only when at least one include is shared. Result across all 525 shared pages: **stacked 93 → 76**. All 16 B pages merge, plus `localization.md` from C. Merged pages are unchanged. For example, `complete-guides/react/prerequisite.md` becomes one cloud-labelled and one self-hosted-labelled prerequisites list, followed by the shared include once.

Optional follow-up: a source rewrite (move the differing lines into the include under `{% if product_name == … %}`) would make the remaining labelled block finer-grained, but it is not needed to stop the stacking.

Examples: `complete-guides/react/prerequisite.md`, `complete-guides/dotnet/add-login-and-logout.md`.

## C. Different include files: 2 (1 converter, 1 source rewrite)

- `guides/branding/localization.md`: cloud includes `localization-overview.md`. Self-hosted includes that file plus `add-remove-locales.md` and `configure-text-direction.md`. Alignment (above) merges the shared overview and labels the two extra sections Self-hosted. **Converter.**
- `guides/user-self-service/configure-self-service-portal.md`: cloud includes `includes/guides/user-self-service/configure-self-service-portal.md`, self-hosted includes `includes/guides/user-self-service/self-service-portal-configurations.md`. They are different documents (20% shared blocks, cloud 23 blocks vs self 55), and the wrappers also set different `my_account_link` values (which, per F, is not the cause). Needs a **source rewrite**: consolidate the two includes into one with conditionals, or accept two pages (an editorial call for [07-removing-stacked-duplicates](../issues/07-removing-stacked-duplicates.md)).

## D. One side inlines a drifted copy of the shared include: 22 (wrapper rewrite)

One wrapper is `{% include "…/includes/<same path>.md" %}`. The other is a full inline page that started as the same text and has drifted.

- Self-hosted includes, cloud inline (12): `get-started/try-samples/{qsg-oidc-webapp-java-ee, qsg-saml-webapp-java-ee, qsg-spa-javascript, qsg-spa-react, ws-federation-webapp}.md`, `references/tutorials/protect-apps-with-identity-gateway/{index, protect-apps-with-mod-auth-openidc, protect-apps-with-oathkeeper, protect-apps-with-oauth2proxy}.md`, `guides/authentication/oidc/add-back-channel-logout.md`, `guides/authentication/saml/saml-federated-idp-initiated-sso.md`, `guides/notification-channels/configure-email-provider.md`.
- Cloud includes, self-hosted inline (10): `guides/account-configurations/index.md`, `guides/applications/register-standard-based-app.md`, `guides/authentication/conditional-auth/{access-control, adaptive-mfa}.md`, `guides/authentication/oidc/index.md`, `guides/index.md`, `guides/users/user-stores/index.md`, `references/conditional-auth/api-reference.md`, `complete-guides/actions/{introduction, prerequisite}.md`.

Shared blocks range from 100% down to 0%:

- `references/tutorials/protect-apps-with-identity-gateway/index.md` renders identically to the include. That one is a pure wrapper rewrite: replace the inline page with the include line.
- Most sit at 55% to 88% with 1 to 34 differing runs. `references/conditional-auth/api-reference.md` has 34 differing runs over 259 blocks.
- `guides/users/user-stores/index.md` (0%), `guides/notification-channels/configure-email-provider.md` (37%) and `guides/applications/register-standard-based-app.md` (19%) are effectively different pages that share a path.

Fix: **wrapper rewrite**. Make the inline side's wrapper include the shared file, after porting that side's real differences into the include as `product_name` / `is_version` conditionals. Hard-coded "WSO2 Identity Server" or "WSO2 Identity Platform" text becomes `{{ product_name }}`. Then the shapes are equal and the existing node-by-node merge handles the rest.

Risks **[inference]**:

- Several of these includes are also used by older IS versions. `qsg-oidc-webapp-java-ee.md` is included by 7.0.0, 7.1.0, 7.2.0, 7.3.0 and `next`. `configure-email-provider.md` is included by 7.2.0, 7.3.0 and `next`. Editing the include changes those versions' generated pages too, unless the edit is guarded by `is_version`. MkDocs compares version strings as strings, which is the latent bug noted in issue 06.
- Choosing which side's drifted text is correct is an editorial decision for the Asgardeo and IS doc owners.

Examples: `get-started/try-samples/qsg-oidc-webapp-java-ee.md`, `guides/account-configurations/index.md`.

## E. Both sides inline, no shared include: 21 (source rewrite)

Neither wrapper includes anything. They are two hand-maintained pages at the same path, with heading, list and structure drift.

- Near-identical (rendered-line similarity 0.84 to 0.95 after normalising product names): `get-started/try-your-own-app/{index, javascript, react, java-ee-oidc}.md`, `guides/user-self-service/build-self-service-capabilities.md` (cloud also adds five `{% set %}` link values), `guides/authentication/conditional-auth/{index, acr-based-adaptive-auth}.md`, `guides/users/manage-users.md`, `page-not-found.md`.
- Partly shared: `get-started/try-your-own-app/java-ee-saml.md`, `get-started/start-integrating-apps/index.md`, `guides/users/manage-groups.md`, `guides/authentication/conditional-auth/acr-and-amr.md`, `apis/organization-apis/scim2/index.md`, `references/index.md`, `tutorials/index.md`, `apis/organization-apis/index.md`, `guides/users/index.md`.
- Essentially different: `guides/users/manage-administrators.md` (9%), `apis/scim2/index.md`, `apis/index.md` (5%; the IS page documents System APIs that Asgardeo does not have).

Fix: **source rewrite**. Move the page body into a new `en/includes/...` file with conditionals, and make both wrappers include it. That is more than a wrapper rewrite, because a new shared include has to be written. Many differences are only the hard-coded product name.

Converter alternative **[inference]**: a fallback that diffs the two *rendered* pages block by block and labels only the differing runs would merge all 43 D and E pages mechanically. It would give good results only where the pages are close: 18 of the 43 have ≥ 70% shared blocks. The other pages would get many interleaved labelled fragments. It also works on rendered text, so it loses the template structure. It would also have to avoid splitting inside lists, admonitions, tabs and code fences, which `renderMerged` currently handles only for conditionals. I would not make it the default. If it is built, gate it on a similarity threshold and report the pages it merges for review.

Examples: `guides/users/manage-users.md`, `get-started/try-your-own-app/react.md`.

## F. `{% set %}` blocks: 0

No stacked page is caused by sets. `shape()` ignores `set` nodes, and `mergePage` evaluates each side's sets into that side's environment. Sets appear in stacked pages (`configure-self-service-portal.md`, `localization.md`, `access-control.md`), but those pages stack because of their includes or inline content. Set values that differ inside merged pages become `<DeploymentValue>` pairs, or `<Applies>` blocks when a set holds a whole Markdown section (`renderMerged`, `var` case).

## What this means for the map

- Doing the converter work first (A plus include alignment) takes the gate in the map ("the PR may not merge while any shared page renders as two stacked copies") from 93 to **44**. The 44 are all source rewrites: 22 D, 21 E, and 1 from C.
- **[inference]** A handful of the 44 are not duplicates but different pages that share a path: `apis/index.md`, `guides/users/user-stores/index.md`, `guides/users/manage-administrators.md`, `apis/scim2/index.md`, `configure-self-service-portal.md`. Ticket 07 should decide whether "two labelled versions" is acceptable for those, rather than forcing a merge.
- The original 119 should be corrected to 93 in the map and in issue 06's follow-ups. The 26 front-matter-only pages already merge.

## Appendix: all 93 pages

A (32): `apis/` action-management-rest-api, api-resource-management-rest-api, approvals-rest-api, branding-preference-rest-api, dynamic-client-registration-rest-api, end-user-credential-management-rest-api, idp, organization-discovery-config-mgt-rest-api, organization-user-share-rest-api, organization-user-share-v2-rest-api, rule-metadata-rest-api, scim2/scim2-users-rest-api, self-password-update-rest-api, user-discoverable-applications, vc-template-management-rest-api, verification-code-management-me-api, verification-code-management-rest-api; `apis/organization-apis/` action-management-rest-api, api-resource-management-rest-api, end-user-credential-management-rest-api, org-account-recovery, org-association-rest-api, org-authenticators, org-role-mgt, organization-application-mgt, organization-user-invitation, organization-user-share-v2, organization-user-share, rule-metadata-rest-api, scim2/scim2-org-group-mgt, scim2/scim2-org-user-mgt, verification-code-management-rest-api.

B (16): `complete-guides/` angular/prerequisite, angular/register-an-application, app-native/prerequisites, app-native/register-an-application, dotnet/add-login-and-logout, dotnet/prerequisites, dotnet/register-an-application, expressjs/add-login-and-logout, expressjs/prerequisite, expressjs/register-an-application, javascript/prerequisite, javascript/register-an-application, nextjs/prerequisite, nextjs/register-an-application, react/prerequisite, react/register-an-application.

C (2): guides/branding/localization, guides/user-self-service/configure-self-service-portal.

D (22) and E (21): listed in full in sections D and E.
