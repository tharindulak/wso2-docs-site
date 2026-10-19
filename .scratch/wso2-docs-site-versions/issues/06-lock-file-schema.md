# Lock file schema for many versions per section

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharinduj
Blocked by: 01, 02, 05

## Question

How does `content-sources.yaml` describe many versions per section: per-version entries with source kind (release, branch, folder, archive), ref and pinned commit; which versions are frozen versus still tracked for fixes; the allow-list that keeps noise branches out; and how older versions with different layouts declare their MkDocs entry point. Also: how each version declares its former site URLs so absolute links into them (569 in API Manager 4.0.0, mostly images) become internal, per [Measure conversion of older versions](03-measure-older-version-conversion.md).

## Answer

Decided with the user, 2026-10-09 (all recommendations accepted).

- **Shape:** a section's `sha`, `track` and `version` fields give way to a `versions:` list. The list is the allow-list for the section's versions, and Latest is the highest version in it, with no separate `latest` field. Unreleased docs are never listed.
- **Source kind is inferred, not declared:**
  - A `ref` that matches the section's `release_tag` + version is a docs release.
  - Any other ref is a legacy branch.
  - A per-version `mkdocs:` or `docs:` path marks a version folder on a shared ref (docs-is, docs-api-platform).
  - The validator rejects ambiguous entries.
- **Tracking:** only Latest follows fixes (`track: true` on its branch). Older versions stay pinned, as frozen snapshots. A fix to an older version ships as a fourth-segment docs release. When a new version is promoted, the same PR clears `track` on the previous Latest.
- **Per-version overrides:** the entry point (`mkdocs`, `docs`, `sidebar`), `sparse`, `exclude` (always per version), `nav_pick`, `skip` and `deployment_overrides`.
- **Section-level only:** route, label, `release_tag`, `product_repo`, `former_site` and `cloud_companion` (Latest only).
- **Former sites:** each section has one `former_site` URL template containing `{version}`, plus the existing `aliases`. Absolute links into a version's current site become internal links to the same version on the docs site, and `/en/latest/` maps to Latest.
- **Versions with no source:** `older_versions` becomes a list of `{version, href}` entries pointing at Confluence.
- **Identity Platform:** `versions:` sits under `self_hosted:`. Only Latest merges with cloud. Older versions convert as plain MkDocs, labelled Self-hosted.
- **Files:** one `content-sources.yaml` for now, about 900 lines with every version listed.
- **Not built yet:** the implementation (fetch, build-content, bump bot and validator), plus the lock-file moves decided in [Choose the Latest source for each section](01-latest-source-per-section.md).

Example:

```yaml
- id: api-platform-apim
  repo: wso2/docs-apim
  mkdocs: en/mkdocs.yml
  release_tag: v
  product_repo: wso2/product-apim
  former_site: https://apim.docs.wso2.com/en/{version}/
  versions:
    - { version: 4.7.0, ref: 4.7.0, sha: 75726eb0a49d..., track: true, exclude: [...] }
    - { version: 4.6.0, ref: 4.6.0, sha: ..., exclude: [] }
    - { version: 3.0.0, ref: 3.0.0, sha: 53584be9c5ba... }
  older_versions:
    - { version: 2.6.0, href: https://wso2docs.atlassian.net/wiki/spaces/AM260 }
```
