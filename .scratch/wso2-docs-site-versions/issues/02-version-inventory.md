# Inventory every published version and where its source lives

Parent: [map](../map.md)
Type: research
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

For every self-hosted section, list each version published on its current docs site (from the site's version selector or `versions.json`), and for each version: the exact source (branch, folder or `versioned_docs` path, with commit), whether a GA product release exists, page count, and whether it has no source at all (archive candidate). Note the MkDocs layout era of each version (theme config shape, `INHERIT`, rebrands). Output one table per section.

## Answer

2026-10-09. Full tables: [research/02-version-inventory.md](../research/02-version-inventory.md).

- Published lists come from each repo's `versions` branch (`en/docs/assets/versions.json`), docs-is `is_common.yml`, SI's `mike` `gh-pages`, and Docusaurus `versions.json`. Live sites sit behind Cloudflare (curl 403); spot checks via WebFetch matched.
- 51 versions have source (about 23,300 `.md` files): release branches for APIM (11), MI (5), SI (3), APK (5), OB (2); version folders for IS (9) and API Platform components (9); `versioned_docs` for Agent Manager; BI, WSO2 Integrator, Healthcare, Updates and Security are single-version.
- 22 listed versions have no source (IS 5.0 to 5.8, APIM 1.9 to 2.6, OB 1.3 to 2.0). All link off-site to Confluence (`wso2docs.atlassian.net`), not to current-site HTML.
- Eras: material 4.x (APIM 3.0 to 4.1, IS 5.9 to 6.1, OB unpinned) vs material 9.1.2 (the rest); IS 7.x uses `INHERIT: ../is_common.yml`; "WSO2 Integrator: MI/SI" rebrand from MI 4.5.0 and SI 4.3.1.
- Mismatches: APK lock pin is main (labelled 1.2.0) while Latest is 1.3.0 and 2.0.0 is live but unlisted; OB 4.0.0 has three candidate refs; MI main says 4.7.0 with no GA; APIM `4.7.0` branch is newer than the pinned master.
- Flag: docs-api-platform `apim-*` and component branches install build hooks from a personal fork (`senthuran16/docs-api-platform`), a supply-chain risk.
