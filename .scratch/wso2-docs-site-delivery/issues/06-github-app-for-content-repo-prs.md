# GitHub App for PRs on content repos

Parent: [map](../map.md)
Type: research (AFK)
Status: closed
Assignee: tharindulak (research agent)
Blocked by: 

## Question

From GitHub's docs: how does a workflow in one repo get a short-lived token to push a branch and open a PR in `wso2/docs-*` repos (GitHub App installation token via `actions/create-github-app-token`, scoped to named repos)? Minimum permissions; whether fine-grained PATs are an acceptable fallback and why not; how to keep the token out of the job that runs conversion code (artifacts between jobs, as `docs-site-snapshots.yml` does); what a force-push to a standing branch does to an open PR and its reviews; whether branch protection or CODEOWNERS on content repos can block the bot; and who in the wso2 org must create and install the App. Also: what does `migrate-docusaurus.mjs` produce today (folders, `generated/tree-review.txt`) that the PR body should carry?

## Resolution

Findings: [06-github-app-for-content-repo-prs.md](../research/06-github-app-for-content-repo-prs.md).

- **Token:** `actions/create-github-app-token@v3` with `owner: wso2`, one repo in `repositories`, `permission-contents: write`, `permission-pull-requests: write`. One-hour lifetime, revoked in the action's post step, so it cannot cross jobs. App permissions: Contents and Pull requests (write), Metadata (read); no Workflows permission, since the tree never writes the repo-root `.github/`. Unverified: GitHub may reject a force-push carrying edit-branch commits that changed workflow files.
- **Fine-grained PAT:** stop-gap only (tied to one person, expires, needs org owner approval; GitHub recommends an App for org automation).
- **Token isolation:** copy the `docs-site-snapshots.yml` shape. Pass the tree as one tarball (`upload-artifact` drops hidden files, which would lose the `.wso2-docs-tree` marker). The token job checks tar entries (no symlinks, `..`, absolute paths or `.github/`), checks `migrate_to` against an allow-list, and fails if `git diff` touches anything outside it. `generated/tree-review.txt` and `content-report.json` are uploaded separately for the PR body.
- **Force-push and blockers:** a changed diff dismisses approvals where "dismiss stale approvals" is on; CODEOWNERS are requested on open or ready-for-review, so open the PR as a draft; rulesets on `docs-site/migration` block the bot unless the App is a bypass actor; required signed commits block plain `git push` commits, while commits created through the API as the App are verified.
- **Setup:** an org owner registers a private App and installs it on selected repos; the App manager role cannot install.
- **Script facts:** the tree holds the marker, `docs/`, `versioned_docs/`, sidebars, `versions.json`, `redirects.json`, `assets/`, `static/`. The script refuses to write on new conversion failures and deletes its output dir recursively, so it runs in runner temp only. `migrate_to:` and section-level `edit:` do not exist in the lock yet.
- **Unverified:** the workflow-file push check, what marks comments outdated, actual rulesets on `wso2/docs-*`, docs-is tree file count (matters for API commits), PR body size limit.
