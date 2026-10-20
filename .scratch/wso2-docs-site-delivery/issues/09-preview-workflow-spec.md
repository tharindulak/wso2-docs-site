# Preview workflow spec

Parent: [map](../map.md)
Type: grilling (HITL)
Status: closed
Assignee: tharindulak
Blocked by: 05, 07, 08, 12

## Question

Specify the Preview workflow from the charting decisions and its blockers: dispatch inputs and their validation, the preview's name and URL, how it reuses the Deploy workflow's upload steps, search turned off, the 14-day cleanup (which job, which permissions), the limit on concurrent previews and disk, and what the person who started it gets back (URL in the run summary).

## Resolution

Decided with the user, 2026-10-20. Builds on [Building one section at a chosen ref](05-single-section-preview-build.md), [Deploy workflow spec](07-deploy-workflow-spec.md), [Hosting config](08-hosting-config-caddy-and-typesense.md) and [CI and a lock pinned to forks](12-ci-and-a-lock-pinned-to-forks.md).

**Already settled:** manual dispatch; Latest of one section with its pin overridden through a temp lock in `DOCS_SITE_LOCK`; served on a subdomain of the VM's sslip.io name from `/srv/docs/previews/<name>/current`; search off; `baseUrl: '/'`, `noIndex: true`, site URL from an env var; refs resolved on the lock's repo (`git ls-remote` for branches and tags, SHAs reachable from a branch of that repo).

- **Inputs:** `section` (required, checked against lock ids); `ref` (required, `^[A-Za-z0-9._/-]{1,100}$`, no `..`, no leading `-`); `source` (`main` or `companion`, required only for sections with a cloud companion); `name` (optional, default `<section>-<ref>` slugged to `[a-z0-9-]`, at most 40 characters); `action` (`create` default, or `delete`). All inputs reach scripts through `env:`.
- **Same name again:** a new folder `previews/<name>/<id>/`, then an atomic switch of `previews/<name>/current`; keep the live and previous copies; the 14 days count from the last update.
- **Jobs and keys:** Build (read-only, content code) uploads with a preview upload key, rrsync limited to `/srv/docs/previews`. Promote (no content code) uses a preview gate key with verbs `preview-switch <name> <id>`, `preview-delete <name>`, `preview-clean` only. Secrets on a `preview` environment limited to the default branch.
- **Cleanup and limits:** a daily schedule runs `preview-clean` (previews not updated in 14 days; incomplete folders older than 24 hours). The gate refuses a new preview at 10 existing or under 10 GB free (API Manager is about 1 GB per copy). One concurrency group per preview name; a newer dispatch cancels the older run.
- **Links:** broken links inside the section's route are reported in the run summary with counts against the Latest baseline, not failed; chrome links are not checked.
- **Output:** the run summary only: preview URL, resolved SHA with a compare link against the pinned SHA, build time, link report, expiry date.
