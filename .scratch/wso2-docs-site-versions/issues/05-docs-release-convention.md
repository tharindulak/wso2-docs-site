# Docs-release convention for content sources

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharinduj
Blocked by: 02

## Question

What exactly is a docs release that product teams cut from now on? Tag name format, how GA is told from prerelease, how the docs version maps to the product release, and what a release means in repos that keep several versions as folders on one branch (docs-is, docs-api-platform) or several components (API Platform). Who cuts it, and what happens to the existing release branches?

## Answer

Decided with the user, 2026-10-09.

- **A docs release is a GitHub Release on the docs repo.** It counts as GA when it is not a draft and not marked prerelease. A bare tag is ignored.
- **Tag names:**
  - `v<version>` in single-distribution repos, for example `v4.8.0`.
  - `<component>/v<version>` in multi-component repos, for example `api-gateway/v1.3.0` in docs-api-platform.
  - The lock file records the prefix for each section.
  - Cloud trees in the same repo are not tagged, because they stay Latest only.
- **Repos with version folders keep their layout.** A release pins a commit, and the site reads the version's folder at that commit (`v7.4.0` reads `en/identity-server/7.4.0/`). The folder name must equal the version.
- **Version numbers:**
  - The docs version equals the product release it documents.
  - Fixes to released docs add a fourth segment (`v4.8.0.1`, `v4.8.0.2`). The site still shows "4.8.0", and the bot's numeric comparison already accepts the extra segment.
- **Bot and approval:**
  - A docs fix release auto-merges on a green build.
  - A new version needs one approval from the product's docs team.
  - If no GA product release matches the docs version, the bot opens an issue instead of a PR.
- **Who publishes:** the product team's docs owner, on or after the product's GA.
- **Existing versions:** the lock file keeps branch and folder pins for the 51 existing versions. Releases apply from each team's next release, with no backfill, and old release branches stay. A team may tag an old version later to ship fixes to it.
- **Where it is written down:** `docs-site/CONTENT-RELEASES.md`, next to the conversion contract, with a short section in the `wso2-docs` CLI README. `wso2-docs check` warns when a version folder and the release tag do not match.
