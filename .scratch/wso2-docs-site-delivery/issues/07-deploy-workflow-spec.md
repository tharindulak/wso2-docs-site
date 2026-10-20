# Deploy workflow spec

Parent: [map](../map.md)
Type: grilling (HITL)
Status: closed
Assignee: tharindulak
Blocked by: 01, 03, 04, 11, 12, 13

## Question

Specify the Deploy workflow end to end from the charting decisions in the map's Notes and the answers of its blockers: jobs and their permissions (which job sees the SSH key, which sees the Typesense admin key, which runs content code), the step order including indexing and the symlink switch, what stops a deploy and how it fails safe, concurrency (one deploy at a time; what happens to a queued one), release pruning, manual rollback, and how manual dispatch picks a commit.

## Resolution

Decided with the user, 2026-10-20. Builds on the map's Notes and [Search index and deploy path](03-search-index-and-deploy-path.md), [Release folders, rsync and restricted SSH](04-release-pattern-on-the-vm.md), [How bot changes reach CI and deploy](11-how-bot-changes-reach-ci-and-deploy.md), [CI and a lock pinned to forks](12-ci-and-a-lock-pinned-to-forks.md), [Bot identity and gates](13-bot-identity-and-gates-for-lock-changes.md), [VM facts and deploy access](01-vm-facts-and-deploy-access.md).

**Triggers** (decided earlier): `workflow_run` after `docs-site snapshots` (guarded: `conclusion == success`, `head_branch` = default branch, `event == push`, `head_repository` = this repo), `workflow_dispatch`, daily schedule. Environment `test` here, `production` only in the org repo.

**Dispatch inputs:** `action` = `deploy` (default) or `rollback`; `commit` optional, a 40-character SHA reachable from the default branch, default its head.

**Jobs and keys** (two keys on the VM, each its own `authorized_keys` line):

1. **Plan** (gate key `DEPLOY_GATE_KEY`, no content code): asks the gate `current` for the live release id and commit; checks disk; stops the run as success when the commit to deploy equals the live commit (a rerun after a failure proceeds).
2. **Build** (read-only token, no gate key, runs content code): checks out the exact commit; frees runner disk with plain `rm` (Android, .NET, Haskell, CodeQL) and fails under 25 GB free; `npm ci --ignore-scripts`, fetch, content, build, assemble (without `--allow-missing`, except on `test` while `allow_missing_snapshots` is set: then Latest only, flagged in the run summary and `.release.json`; `production` never sets it), link check with baselines; writes `_search/records.jsonl` (`search-index.mjs --dry-run`) and `_search/schema.json`; writes `.release.json` (commit, release id, build time, run URL). Uploads with the upload-only key (`DEPLOY_SSH_KEY`, rrsync `-wo -no-del -munge` into `releases/`) using `--checksum --link-dest=/<current-id>/ --chmod=D755,F644` without `-t`, to `releases/<UTC timestamp>-<short sha>/`, the `.release-complete` marker last. Measure the hard-link saving on the first deploy (inferred, untested).
3. **Promote** (gate key, no content code): `switch <id>`. The gate checks the id format and marker, creates collection `docs_<id>` from the release's schema, imports its records, switches `current` atomically (`ln -s` temp + `mv -T`), moves the `docs` alias, records the collection in `.release.json`, then prunes. Import or alias failure stops before the switch.

**Gate** (root-owned forced command, runs as `deploy`): verbs `current`, `switch <id>`, `rollback`, `prune`, nothing else; strict id validation. The Typesense admin key lives only on the VM; the gate talks to Typesense over local HTTP with `curl`. Typesense's admin API is never exposed; only the search-only path is public through Caddy.

**Rollback:** dispatch `action=rollback` runs Promote only: switch to the previous complete release and move the alias to its recorded collection.

**Failure and cleanup:** anything failing before Promote leaves the live site untouched; a folder without `.release-complete` cannot be switched to; prune keeps the live, previous and one more complete release with their collections and deletes incomplete folders older than 24 hours.

**Concurrency:** one group `deploy-test` (deploys and rollbacks), no cancel in progress, a newer pending run replaces an older one. Preview has its own group, key, environment and folder.

**Still to do on the VM** (hand-off): write and install the gate, create the gate key and its secret `DEPLOY_GATE_KEY`, Typesense and the admin key on the VM (see [Hosting config for Caddy and Typesense](08-hosting-config-caddy-and-typesense.md)).
