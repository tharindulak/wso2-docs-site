# Docs releases for content sources

How a product team ships a new version of its docs to the docs site. Conversion rules are in the conversion contract (`.scratch/wso2-docs-site/issues/13-conversion-contract.md`); this page covers releases only.

## What a docs release is

A docs release is a GitHub Release on your docs repository. It counts as GA when it is not a draft and not marked prerelease. A bare tag is ignored. The release pins one commit; the site builds that version from it.

## Tag names

- `v<version>` in single-distribution repos, for example `v4.8.0`.
- `<component>/v<version>` in multi-component repos, for example `gateway/v1.3.0` for the API Gateway in docs-api-platform. The lock file records the prefix for each section (`release_tag`).
- Cloud trees in the same repo are not tagged. They stay Latest only.

The docs version equals the product release it documents.

## Fixing released docs

A fix to a released version adds a fourth segment: `v4.8.0.1`, then `v4.8.0.2`. The site still shows "4.8.0". The bot moves that version's pin to the newest fix tag. Latest, while it tracks a branch, takes no fix tags: it already follows the branch, and a tag at an older commit would move it backwards.

## What merges by itself

| Release | What the bot opens | Approval |
|---|---|---|
| Fix (`v4.8.0.1`) | Bump PR | Auto-merges when the docs-site build passes |
| New version (`v4.9.0`) | Promotion PR: it becomes Latest; the old Latest and older versions are snapshots (the live build holds Latest only) | One approval from your product's docs team |
| New version with no matching product GA release | An issue, no PR | Publish the product release, then the next daily run opens the PR |

Only Latest tracks a branch (hourly bumps). Older versions stay pinned to a tag or commit, even when they pin the same commit as Latest (folders on one branch): a bump changes only the tracking entry.

A fix or promotion changes snapshot keys. The PR's build passes with those snapshots reported as pending; the snapshot workflow builds and stores them after merge, and a deploy waits until every key is stored.

## Publish on or after the product's GA

The bot promotes a docs release only when the product repository has a GA release with the same version. Publish docs on or after the product's GA, never before.

## Version folders

Repos that keep several versions as folders on one branch (docs-is, docs-api-platform) keep that layout. The site reads the version's folder at the release commit: `v7.4.0` reads `en/identity-server/7.4.0/`. The folder name must equal the version. The section's `version_folder` in the lock file (for Identity, `en/identity-server/{version}/mkdocs.yml`) names the folder; a promotion writes it into the new entry. API Platform components name it with `docs_root` instead (for the API Gateway, `api-gateway/{version}/` inside the site's `docs` folder, so `gateway/v1.3.0` reads `en/docs/api-gateway/1.3.0/`). For either kind, planning reports `missing-version-folder` instead of promoting when the folder is absent at the tag.

## Existing versions

The lock file keeps the branch and folder pins of the versions that already exist. Releases apply from your next release, with no backfill, and old release branches stay. You may tag an old version later to ship fixes to it.

When a re-pin makes more internal links break than the committed baseline allows (`docs-site/link-baselines/<versionId>.json`), the snapshot build fails. If the breakage comes from the source, record the new baseline with `node scripts/snapshots.mjs build <versionId> --record-baseline` in a reviewed PR.

## Check a release before you publish it

Run inside your docs repo:

```sh
npx wso2-docs check --release-tag v7.4.0 --version-folder 'en/identity-server/{version}'
```

It converts every page as usual and prints a warning, with exit code 0, when the release has no folder for its version:

```
warning: release v7.4.0 has no folder en/identity-server/7.4.0
```

Both options go together. The tag may be `v<version>` or `<component>/v<version>`; a fourth segment is ignored when the folder is derived.
