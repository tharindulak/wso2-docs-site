# Release folders, rsync and restricted SSH on the VM

Parent: [map](../map.md)
Type: research (AFK)
Status: closed
Assignee: tharindulak (research agent)
Blocked by: 

## Question

From primary sources (rsync, rrsync, OpenSSH, nginx and GitHub Actions docs): how does `rsync --link-dest` into a timestamped folder followed by an atomic symlink switch behave with nginx (does nginx follow the switch without a reload; `disable_symlinks`, open file cache)? Does rrsync allow `--link-dest` to a sibling folder and the symlink switch, or is a separate forced command needed for the switch, pruning and preview cleanup? What do `restrict` and `command=` in `authorized_keys` allow? How should known_hosts be pinned in a workflow? What are the limits and protections of GitHub environment secrets and deployment branch rules, and which of these differ for a public repo?

## Resolution

Findings: [04-release-pattern-on-the-vm.md](../research/04-release-pattern-on-the-vm.md), including a gate script sketch.

- **Switch:** nginx follows a `current` symlink switch without reload. Switch with `ln -s` to a temp name then `mv -T` (atomic rename). Keep `open_file_cache` off (else up to 60 s stale). In-flight requests finish from old files. Add `disable_symlinks on from=$document_root`.
- **rrsync:** `--link-dest` works only root-anchored (`--link-dest=/<prev-id>/`); a relative path silently links nothing on 3.2.7. rrsync cannot switch, prune, roll back or delete previews, so a small root-owned gate script is needed: rsync calls go to `rrsync -wo -no-del -munge`, every other command matched against a fixed list with validated arguments. Docusaurus rewrites every mtime, so `-a` defeats hard links; likely fix `--checksum` without `-t` (inference; test on the VM).
- **Key options:** `restrict` blocks forwarding, PTY and `~/.ssh/rc`; `command=` forces the command (sftp too). `from=` is impractical (about 7,000 GitHub Actions ranges, changing weekly, shared Azure ranges).
- **Keys in CI:** `known_hosts` line taken from the VM console, never `ssh-keyscan` in CI; `StrictHostKeyChecking=yes` with a temp `UserKnownHostsFile`; private key written to `$RUNNER_TEMP` with mode 600 in plain shell, no third-party action.
- **Environments and `workflow_run`:** public repo, so every environment feature is available on any plan. A `workflow_run` job always runs with `GITHUB_REF` set to the default branch, so a "main only" environment rule passes even for runs that came from PRs or forks. Deploy must check `head_branch`, `event` and `head_repository` explicitly, or deploy from the push workflow itself. Separate keys and environments for preview and production.
- **Unverified:** whether Ubuntu 24.04's rsync 3.2.7 carries the fix for a reported high-severity rrsync escape (the agent cites CVE-2026-53783, fixed upstream in 3.5.0; not checked here); maximum approval wait; `fs.protected_hardlinks` on the VM. Gate script and nginx config need peer review and a test before production.
