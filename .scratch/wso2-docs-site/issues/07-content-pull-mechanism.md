# How the docs site pulls content

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharinduj
Blocked by: 02, 06

## Question

Which mechanism does the docs site use to pull each content source, who or what triggers a rebuild when a team merges, and how does each team's layout (version folders or version branches) map to the site's versions?

## Answer

Decided with the user, 2026-10-06. Input: [Pulling content sources](../research/02-pulling-content-sources.md).

- **Pinned, automatic.** The docs-site repo holds a lock file pinning every content source to a commit SHA. A bot opens a bump PR when a source changes; it auto-merges when conversion and build pass. The content team's own PR is the content review. Rollback is reverting one bump commit. Safety relies on the converter refusing unsafe content: see [Build-time conversion contract](13-conversion-contract.md).
- **Pull-based trigger.** A scheduled job in the docs-site repo (hourly, plus manual run) checks the public content repos with `git ls-remote`. No tokens in content repos; checkouts use `persist-credentials: false`; Actions pinned by SHA.
- **Lock file shape**, per product:
  ```yaml
  identity:
    cloud:       { repo: wso2/docs-is, path: en/asgardeo/docs, sha: … }
    self_hosted:
      latest:    { version: 7.3.0, repo: wso2/docs-is, path: en/identity-server/7.3.0/docs, sha: … }
      archived:  [ { version: 7.2.0, path: …, sha: … } ]
  ```
  Branch-per-version repos (docs-apim, docs-mi) name an explicit branch per entry for the bump bot; stray branches are never picked up. docs-is entries share one SHA because `en/includes` is shared across versions. Each product's Latest is built from `cloud` plus `self_hosted.latest`; how archived versions are kept is [Versioning details](08-versioning-details.md).
- **Latest self-hosted** is the newest GA release (docs-is: 7.3.0); `next` is not published.
- **Writer preview:** run the docs site locally with an override pointing a product at a local checkout instead of the pinned SHA.
- **Images:** copied for the versions being built, via sparse, shallow, blob-filtered checkouts. Dedup or CDN deferred.
