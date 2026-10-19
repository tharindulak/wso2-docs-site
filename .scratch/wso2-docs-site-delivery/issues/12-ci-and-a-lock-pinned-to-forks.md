# CI and a lock pinned to forks

Parent: [map](../map.md)
Type: grilling (HITL)
Status: closed
Assignee: tharindulak
Blocked by:

## Question

With `CI` set, `readLock()` rejects the committed lock because 17 sources pin `tharindulak/*` forks (surfaced by [Building one section at a chosen ref](05-single-section-preview-build.md)), so no workflow can run in this fork today. Testing here was decided to use fork content repos. Which way: allow forks in CI only in this test repo (and how that stays impossible in the wso2-org repo), re-pin the lock to `wso2/*` repos before any workflow runs, or keep a separate test lock? Related: GitHub serves fork-only commits through the parent repo URL, so whichever rule is chosen must not rely on the repo URL alone.

## Resolution

Decided with the user, 2026-10-19.

- **Forks are temporary stand-ins.** The `tharindulak/*` forks hold converted trees and content fixes the wso2 repos do not have yet; the lock moves back to `wso2/*` as migration PRs land. While testing, the same forks are the content repos the Migration workflow opens PRs on.
- **CI accepts fork owners from a repo variable.** `lib.mjs:14` reads `DOCS_SITE_TEST_OWNER` in CI too, from a GitHub repository variable set only in this fork, and ignores it whenever `GITHUB_REPOSITORY_OWNER` is `wso2`. One lock file; the org repo fails closed on a fork pin. Needs a test for both owners.
- **The VM is a test environment while forks are pinned.** GitHub environment `test` (not `production`), `noindex` site-wide, no public links. `production` exists only in the org repo.
- **Reachability rule.** Every pinned SHA must be reachable from the branch the lock names for that source (`track`, or a version's `ref`) on the repo the lock names, checked once in `fetch-sources.mjs`, so deploys, previews, snapshots and migration all inherit it. For forks the check runs against the fork.
