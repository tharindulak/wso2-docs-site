# Clone the fork and record a conversion baseline

Parent: [map](../map.md)
Type: task (AFK)
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

Clone https://github.com/tharindulak/docs-is into `/Users/admin/Documents/wso2/git/docs` (add `wso2/docs-is` as a read-only `upstream` remote, no push URL), check that it matches the lock file's pinned SHA or note the drift, and create a working branch. Run the current converter on every IS version in the lock file plus the merged Latest, and record per version: pages, failures, excluded pages, stacked duplicates, `<Applies>` and `<DeploymentValue>` counts, and output size including images. Resolution records the branch name, SHA and the table.

## Answer

Done 2026-10-13.

- **Clone:** `/Users/admin/Documents/wso2/git/docs` from `tharindulak/docs-is` (blob-filtered). `upstream` = `wso2/docs-is`, fetch only (push URL set to `DISABLED`). Working branch **`docusaurus-migration`** (local, not pushed).
- **Drift:** fork `master` = upstream `master` = `13256c3613abc74ee81ce9f09b796139ca6be1c6` (2026-10-12), one commit past the lock's pinned `c2176fcd1b50` (adds OpenID4VP docs, 22 files).
- **How measured:** the docs-site converter (main checkout's `packages/`, dist current with the working tree) run from a scratch copy of `docs-site/` whose lock file pins docs-is to `13256c36`, with `.cache/sources/wso2__docs-is@13256c3613ab` linked to the fork. The main checkout's `generated/` was not touched. `node scripts/build-content.mjs identity identity--v7-2-0 … identity--v5-9-0`, 83 s.

| Version | Pages ok | Excluded (redirected) | Failing (all excluded) | Nav entries dropped | `<Applies>` | `<DeploymentValue>` | Output size |
|---|---|---|---|---|---|---|---|
| Latest (Asgardeo + 7.3.0) | 1,022 | 3 | 2 | 0 | 670 | 20 | 838 MB |
| 7.2.0 | 816 | 2 | 2 | 0 | 0 | 0 | 642 MB |
| 7.1.0 | 733 | 2 | 2 | 0 | 0 | 0 | 507 MB |
| 7.0.0 | 564 | 0 | 0 | 2 | 0 | 0 | 413 MB |
| 6.1.0 | 782 | 4 | 4 | 0 | 0 | 0 | 266 MB |
| 6.0.0 | 778 | 4 | 4 | 0 | 0 | 0 | 263 MB |
| 5.11.0 | 640 | 0 | 0 | 0 | 0 | 0 | 429 MB |
| 5.10.0 | 615 | 0 | 0 | 3 | 0 | 0 | 412 MB |
| 5.9.0 | 563 | 0 | 0 | 2 | 0 | 0 | 388 MB |

- **Merge (Latest):** 93 shared pages stack (diverged), 369 split blocks. Counts are tags in output, so they do not match ticket 06's older "290 blocks / ~600 values" counting.
- **Failing pages (14 across 5 versions, 7 distinct causes)**, input for [Make the excluded Identity pages convert](06-make-excluded-pages-convert.md):
  - Latest, 7.2.0, 7.1.0: `guides/organization-management/manage-organizations.md` (unsupported block `{% set organization_search_content %}`); `guides/users/attributes/configure-multi-valued-contact-attributes.md` (inline ternary on `product_name`).
  - 6.1.0, 6.0.0: `developer-portal/applications/edit-mobile.md` and `edit-windows.md` (include `quick-starts/android.md` / `windows.md` not found); `guides/identity-federation/configure-shibboleth-idp-as-a-trusted-identity-provider.md` (include `./includes/deploy-travelocity.md` not found); `guides/password-mgt/recovery-confirmation.md` (include `insert-fragment` not found).
  - Latest: `guides/service-extensions/understanding-service-extensions.md` now converts and can leave the exclude list.
- **Dropped nav entries** (in nav, no page): 7.0.0 `deploy/product-compatibility.md`, `deploy/deploy-is-on-kubernetes.md`; 5.10.0 `learn/device-flow-grant.md`, `learn/try-device-flow.md`, `setup/enabling-hsts.md`; 5.9.0 `develop/support-email-account-verification-for-an-updated-email-address.md`, `setup/enabling-hsts.md`.
- **Size:** converted docs total about 4.2 GB (1,993 image files in Latest alone; each version carries its own image copies), plus about 210 MB of static files. The MkDocs `en/` tree is 4.6 GB and `.git` 957 MB. Committing the tree as converted today roughly doubles the repo; input for [Docusaurus tree format decisions](12-tree-format-decisions.md).
- **Size breakdown** (follow-up, 2026-10-13): of the converted output, text (MDX, JSON) is 0.06 GB and binary files are 3.6 GB (PNG 3.0 GB, sample `.war` attachments 0.29 GB, GIF 0.18 GB). By content hash the binaries are only 1.2 GB unique: about two thirds are the same images copied into each version. The duplication is inherited from `en/`, where each IS version folder carries its own images (350 to 620 MB each). Git stores identical blobs once, so the repo history (`.git`, 957 MB today) grows by far less than the checkout size; the checkout is what doubles.
