# Migration workflow spec

Parent: [map](../map.md)
Type: grilling (HITL)
Status: closed
Assignee: tharindulak
Blocked by: 06

## Question

Specify the Migration workflow from the charting decisions and its blocker: the `migrate_to:` lock field (name, validation, which sections set it), the read-only conversion job and how its output reaches the push job, branch and PR naming, the PR body (what changed, tree-review notes, how to merge at cutover), behaviour when the PR was closed or the branch edited by a person, and which content repos the App is installed on first (fork repos while testing here).

## Resolution

Decided with the user, 2026-10-19. Builds on [GitHub App for PRs on content repos](06-github-app-for-content-repo-prs.md) and the charting decisions in the map's Notes.

- **Lock during migration:** the section stays on its MkDocs source and gains `migration: { path: docusaurus }` (path checked against an allow-list pattern, default `docusaurus`; replaces the research's `migrate_to:`). The live site keeps building from MkDocs. Cutover is one reviewed lock PR switching the section to `kind: docusaurus`, `tree_root: <path>` and the merge commit. In the org repo, today's fork-migrated sections start this way from their wso2 MkDocs sources; this fork keeps its fork-tree pins for testing the site.
- **Target and versions:** the PR goes against Latest's `track` branch. The tree carries every version the lock lists (`docs/`, `versioned_docs/`, `versions.json`), each version's edit links on its own branch; older version branches stop being sources after cutover.
- **Jobs:** a read-only job runs `migrate-docusaurus.mjs <section> $RUNNER_TEMP/tree` and uploads the tree as one tarball plus `tree-review.txt` and the content report. A push job with the App token (no repo or content code run) checks the tarball (no symlinks, hard links, `..`, absolute paths or `.github/`), copies it into `<path>/` of the content checkout, and fails if the diff touches anything outside `<path>/`.
- **Commits:** a fresh commit force-pushed to `docs-site/migration` with `git push`. Where a content repo's rulesets require signed commits on that branch, the App is a bypass actor for that branch only; the merge commit GitHub creates is signed.
- **People touching the PR:** commits on the branch not made by the App fail the run with a clear message and are not overwritten; a PR closed unmerged is not reopened unless dispatched with `reopen: true`; a merged PR makes the run refuse and point to the cutover lock PR.
- **PR:** always a draft. Body: section, versions and pinned SHAs, converter commit, conversion report counts, `tree-review.txt` as a checklist linking file and line, and a "generated: rerun the workflow, do not edit; how cutover works" note. Cut below GitHub's 65,536-character limit; full lists kept as a workflow artifact.
- **Access:** manual dispatch by anyone with write access to this repo, input a section id that has a `migration:` block. The migration App's key lives in a `migration` environment limited to the default branch, no required reviewer (the content team decides on merge).
- **Testing:** a test App owned by the user's account, installed on the `tharindulak/docs-*` forks. The org App is created at the org move by a wso2 org owner.
