# 04 Release folders, rsync and restricted SSH on the VM (researched 2026-10-19)

Ticket: "Release folders, rsync and restricted SSH on the VM". Decided design under test: rsync into a timestamped release folder with `--link-dest` pointing at the current release, atomic `current` symlink switch served by nginx, keep 3 releases, rollback by repointing; `deploy` user without sudo, key restricted with `restrict` plus an rrsync forced command, pinned host key, secrets on a `production` environment limited to `main`; previews on the same VM in a separate tree, deleted after 14 days; public repo.

Sources: rsync/rrsync source and man pages from `RsyncProject/rsync` (master, 3.5.1, and tag v3.2.7), OpenSSH man pages on man.openbsd.org, nginx docs and `src/core/ngx_open_file_cache.c`, GNU coreutils NEWS, GitHub Docs, the GitHub `/meta` API, Ubuntu/Debian package pages. All fetched 2026-10-19. **[inference]** marks my reasoning; **[unverified]** marks claims not confirmed in a primary source.

## Short answers

1. **nginx follows the switch with no reload.** With `root /srv/docs/prod/current;`, nginx opens each file by path, so the kernel resolves the `current` symlink on every open. `$realpath_root` only matters when something downstream caches the path (FastCGI/PHP); a pure static site can use `root`. Leave `open_file_cache` off, which is the default. If it is on, a cached path can serve the old file for up to `open_file_cache_valid` (default 60 s) after the switch. Hard-linked unchanged files keep the same inode, so the cache stays correct for them. In-flight requests keep their open fd and finish from the old inode, even if that release is pruned. For the switch, use `ln -s <target> current.tmp && mv -T current.tmp current` (a single `rename(2)`). GNU `ln -sfn` has also been temp+rename since coreutils 8.27, but BSD and busybox `ln` are not guaranteed to be. Add `disable_symlinks on from=$document_root;` so nginx follows `current` but refuses any symlink inside a release.
2. **rrsync can do `--link-dest` to a sibling, but not the rest.** The path must be anchored at the restricted root with a leading slash (`--link-dest=/20261019T101500Z-abc1234/`). `..` is refused. A bare relative path is validated against DIR, but in 3.2.7 rsync then reads it relative to the destination folder, so linking silently does nothing. rrsync only ever runs `rsync --server`, so it **cannot** switch the symlink, prune, roll back or delete previews. **A small root-owned forced-command gate script is needed.** It execs rrsync when `SSH_ORIGINAL_COMMAND` starts with `rsync --server ` and otherwise handles a fixed set of verbs with strict validation. Use `rrsync -wo -no-del -munge`. **Important:** Docusaurus rewrites every file's mtime on each build, so `-a`/`-t` defeats `--link-dest`. Use `--checksum` without `-t` to get hard links (**[inference]**, test it).
3. **What the key options do.** `restrict` turns off port, agent and X11 forwarding, PTY and `~/.ssh/rc`, plus any restriction added in future. It does **not** limit what command runs. `command=` forces one program for shell, exec **and subsystem** (so sftp too) and exposes the client's request as `SSH_ORIGINAL_COMMAND`. `from=` adds a source-address check and accepts CIDR. **`from=` is not practical with GitHub-hosted runners:** `/meta` lists 7,038 `actions` ranges today (5,510 IPv4), they change weekly, they are shared Azure datacenter ranges, and GitHub says not to use them as allowlists. Static IPs need larger runners (paid) or self-hosted runners.
4. **Host key pinning and the private key.** Store the full `known_hosts` line, taken out of band from the VM console (not from `ssh-keyscan` in CI), as a secret. Use `-o StrictHostKeyChecking=yes -o UserKnownHostsFile=$RUNNER_TEMP/known_hosts -o BatchMode=yes -o IdentitiesOnly=yes`. Write the key to `$RUNNER_TEMP` with umask 077 / mode 600 and remove it in an `if: always()` step. That is plain shell, so no third-party action is needed. If `webfactory/ssh-agent` is used anyway, pin it to the full SHA (v0.10.0 = `e83874834305fe9a4a2997156cb26c5de65a8555`) and set `log-public-key: false`.
5. **Environment rules and `workflow_run`.** The repo is public, so environment secrets, required reviewers (up to 6, one approval needed), prevent self-review, wait timer (1 to 43,200 min), deployment branch/tag rules and admin bypass are available on **every** plan. For private repos on Free/Pro/Team, reviewers and wait timers are unavailable. **A `workflow_run` job always gets `GITHUB_REF` = the default branch**, so a "main only" rule passes even when the upstream run was a PR or fork build. The rule does not protect `workflow_run` deploys. Either deploy production from the `push` workflow itself, or add explicit `if:` checks on `github.event.workflow_run.*`.

## 1. `--link-dest`, the symlink switch and nginx

### rsync `--link-dest` behaviour

- "unchanged files are hard linked from _DIR_ to the destination directory. The files must be identical in all preserved attributes (e.g. permissions, possibly ownership)". "If a match is found that differs only in attributes, a local copy is made and the attributes updated." "If _DIR_ is a relative path, it is relative to the destination directory." Up to 20 `--link-dest` dirs. "This option works best when copying into an empty destination hierarchy, as existing files may get their attributes tweaked, and that can affect alternate destination files via hard-links." https://github.com/RsyncProject/rsync/blob/master/rsync.1.md (`--compare-dest`, `--copy-dest`, `--link-dest`); online: https://download.samba.org/pub/rsync/rsync.1
- **mtime trap [inference, test before relying]:** a fresh `docusaurus build` gives every output file a new mtime. With `-a` (which includes `-t`), mtime is a preserved attribute. Unchanged files then either go through the size+mtime quick check as "changed" or, with `-c`, match by content but differ in mtime, so they become a *local copy* and not a hard link. Either way the release costs the full ~10 GB of disk again. The likely fix is `-rlc --no-times --perms --chmod=D755,F644 --omit-dir-times` (content-compared, mtime not preserved). Changed files then get the upload time as mtime, which nginx uses for `Last-Modified`/`ETag`. The cost of `--checksum` is that both ends read every file each deploy (about 10 GB of I/O on the runner and on the VM). Check linking with `stat -c %h` (link count > 1) on a dry deploy. Do not normalise mtimes in CI as a shortcut: same-size content changes would then be skipped by the quick check.
- Never use `--inplace` or `--append` with `--link-dest`. They would write into an inode shared with the live release. By default rsync writes a temp file and renames it, which leaves the linked inode untouched **[inference from rsync's documented default; rrsync does not block `--inplace`]**.
- Debian/Ubuntu: the same filesystem is required for hard links. Keep `releases/` and `current` on one filesystem.

### Atomic switch: `ln -sfn` vs `mv -T`

- GNU coreutils NEWS, release 8.27 (2017-03-08): "If the file B already exists, commands like 'ln -f A B' and 'cp -fl A B' no longer remove B before creating the new link. That is, there is no longer a brief moment when B does not exist." https://github.com/coreutils/coreutils/blob/master/NEWS . So `ln -sfn` on any current Ubuntu/Debian is atomic. **[unverified]** for busybox/BSD `ln`, which historically unlink first.
- The portable, explicit form is `ln -s -- "releases/$id" .current.tmp && mv -T -- .current.tmp current`. `mv -T` calls `rename(2)`, which replaces `newpath` atomically ("If newpath already exists, it will be atomically replaced, so that there is no point at which another process attempting to access newpath will find it missing", https://man7.org/linux/man-pages/man2/rename.2.html). Without `-T`, `mv tmp current` would move the link *into* the directory that `current` points at. Prefer this form in the gate script: it does not depend on the coreutils version and states the intent.
- Use a relative target (`releases/<id>`) so the tree can be moved and the link read without the absolute path.

### nginx

- `root`: "A path to the file is constructed by merely adding a URI to the value of the root directive." `$realpath_root`: "an absolute pathname corresponding to the root or alias directive's value for the current request, with all symbolic links resolved to real paths." https://nginx.org/en/docs/http/ngx_http_core_module.html#root , #var_realpath_root
- **No reload needed [inference from the above plus how open(2) works]:** without the open-file cache, every request does a fresh path open, so the kernel follows the new `current` target immediately. This matters because the `deploy` user cannot run `nginx -s reload` (no sudo). The design must not need a reload, and it doesn't.
- `$realpath_root` vs `root`: the well-known reason for `$realpath_root` is passing `SCRIPT_FILENAME`/`DOCUMENT_ROOT` to PHP-FPM/opcache, which cache by path. For static files it changes nothing **[inference]**. Use `root /srv/docs/prod/current;`.
- `open_file_cache` (default `off`) caches "open file descriptors, their sizes and modification times; information on existence of directories; file lookup errors". `open_file_cache_valid` defaults to 60 s; `open_file_cache_errors` defaults to off. Source `ngx_open_file_cache.c`: a cached entry is reused while `now - file->created < of->valid`. After that the path is re-stat'd and the entry is kept only if `of->uniq == file->uniq` (same inode), otherwise reopened. https://github.com/nginx/nginx/blob/master/src/core/ngx_open_file_cache.c . Consequences **[inference]**:
  - unchanged files are hard links, so they have the same inode in old and new release and the cache stays valid;
  - changed files can be served stale for up to `open_file_cache_valid` after the switch;
  - with `open_file_cache_errors on`, a new URL can 404 for up to that time.
  
  Recommendation: keep it off. For about 10 GB of static files the OS page cache does the real work. If it is turned on, use `open_file_cache_valid` of a few seconds and leave errors off.
- `disable_symlinks` (default `off`): "`on` If any component of the pathname is a symbolic link, access to a file is denied." "`from=part` ... symbolic links are checked only from the pathname component that follows the specified initial part." The example is `disable_symlinks on from=$document_root;`. It needs `openat()`/`fstatat()` (Linux has them) and "add[s] a processing overhead". Same URL, #disable_symlinks. With `root .../current`, `$document_root` is the unresolved `.../current`, so the `current` link is allowed and any symlink *inside* a release is refused **[inference from the `from=` wording]**. This stops a compromised deploy key from publishing a symlink to `/etc/...` that nginx would serve. Pair it with rrsync `-munge`.
- **In-flight requests [inference, POSIX semantics]:** a response being sent via `sendfile` holds an open fd on the old inode. Repointing `current` or `rm -rf` of an old release does not interrupt it; the blocks are freed when the fd closes. In the short window a browser can fetch an HTML page from release N and an asset from N+1. Docusaurus asset names are content-hashed, so the main risk runs the other way: an already-open tab asking for an old hashed chunk that `current` no longer contains gives a 404 on client-side navigation. Keeping 3 releases on disk does not help unless nginx is told to fall back. An optional `try_files $uri @prev` for `/assets/` pointing at a `previous` symlink is a design option, not researched further.

## 2. rrsync and the forced-command gate

### Versions on the VM

- rrsync became a Python script in **3.2.4** with `-munge`, `-no-lock`, `-no-del`, and rejection of `-L`/`-k`/`-K` (NEWS 3.2.4). `-no-overwrite` arrived in 3.3.0. https://github.com/RsyncProject/rsync/blob/master/NEWS.md
- **CVE-2026-53783 (HIGH), fixed in 3.5.0 (2026-08-13):** rrsync "validated each argument with `realpath()` and then exec'd rsync against the same name (a TOCTOU window)". Now it inode-pins via `/proc/self/fd`, forces `--no-D`, and denies `--copy-unsafe-links`. 3.5.0 also passes `--confine-root=DIR` to close a merge-file read-back leak. 3.5.1 (2026-09-21) fixed rrsync restricted-root path regressions. Same NEWS file.
- Ubuntu 24.04 ships `rsync 3.2.7-1ubuntu1.5`, which includes `/usr/bin/rrsync`. Debian 13 ships `3.5.0+ds1-0+deb13u1`. https://packages.ubuntu.com/noble/rsync , https://packages.ubuntu.com/noble/amd64/rsync/filelist , https://packages.debian.org/trixie/rsync . **[unverified]** whether Ubuntu backported the CVE fix into 3.2.7. Check the Ubuntu security tracker before choosing the OS. **[inference]** The TOCTOU needs an attacker who can flip paths inside DIR concurrently, which here is only the deploy key itself, so the practical risk is low. Still prefer a patched build.

### What rrsync permits (source: `support/rrsync`, master and v3.2.7)

- It only runs rsync: `if command[0:1] != ['rsync']: die(...)`, `if command[1:2] != ['--server']: die(...)`. The only other accepted command is literal `true` (connectivity check). https://github.com/RsyncProject/rsync/blob/master/support/rrsync
- **So rrsync cannot switch the symlink, prune or delete previews** in any supported way. With `-no-del` it cannot delete at all. Without `-no-del` and with `-l`, a client could push a symlink named `current`, but that lets the client aim it anywhere, and `-munge` deliberately breaks it.
- `'link-dest': 2`, "2 = only check the arg when receiving". Validation: `..` anywhere dies ("do not use .. in ... (anchor the path at the root of your restricted dir)"). A leading `/` means DIR-root (`arg = args.dir + arg`). The resolved `realpath` must stay under DIR. In master the validated inode is then passed as `/proc/self/fd/N`, and a missing `--link-dest` DIR becomes a pinned empty dir (first deploy works).
- **Link-dest gotcha [inference from v3.2.7 source + rsync man]:** a *relative* `--link-dest=prev` is checked by rrsync as `DIR/prev` (cwd is DIR) but passed unchanged in 3.2.7. rsync then reads it relative to the *destination*, i.e. `DIR/<new>/prev`, which doesn't exist, so the deploy silently uploads everything. **Always use the root-anchored form `--link-dest=/<previous-id>/`.** That behaves the same in 3.2.7 and 3.5.x.
- Pointing link-dest at the `current` symlink works only if `current` is inside DIR (rrsync resolves it, and master pins the target inode). This sketch keeps `current` **outside** DIR so the rsync channel can never overwrite it. The gate's `current` verb returns the release id for `--link-dest=/<id>/`.
- Recommended flags: `rrsync -wo -no-del -munge DIR`.
  - `-wo`: "Allow only writing to the DIR." It refuses `--sender`.
  - `-no-del`: "Disable rsync's `--delete*` and `--remove*` options." Not needed when uploading into an empty new folder.
  - `-munge`: server-side `--munge-links`, so uploaded symlinks are unusable.
  - Leave the default single-run lock on: it serialises two uploads.
  - `-no-overwrite` is optional. It enforces `--ignore-existing`, which is harmless for a fresh folder but makes a retried partial upload skip already-complete files.
  
  Man page: https://github.com/RsyncProject/rsync/blob/master/support/rrsync.1.md (online https://download.samba.org/pub/rsync/rrsync.1).
- rrsync man, BASH SECURITY ISSUE: if the user's shell is bash it "may try to be overly helpful and ensure that the user's login bashrc files are run prior to executing the forced command". Set the `deploy` user's shell to `/bin/sh` (dash on Debian/Ubuntu) and keep the home directory out of DIR.
- "there can be just one restricted dir per authorized key". So production and previews should use **two keys**, each on its own `authorized_keys` line with its own gate argument. That fits two GitHub environments (`production`, `preview`).

### Safest shape (sketch, not tested)

Layout (one filesystem):

```
/srv/docs/prod/releases/<id>/      # rrsync DIR for the prod key; owned by deploy
/srv/docs/prod/current -> releases/<id>   # created only by the gate
/srv/docs/preview/builds/pr-<n>-<id>/     # rrsync DIR for the preview key
/srv/docs/preview/live/pr-<n> -> ../builds/pr-<n>-<id>
```

`AuthorizedKeysFile /etc/ssh/authorized_keys/%u` (root-owned), so nothing the deploy user can write affects its own keys. See sshd_config(5) https://man.openbsd.org/sshd_config.5 . Optionally add a `Match User deploy` block with `PasswordAuthentication no`, `DisableForwarding yes`, `PermitTTY no` (**[unverified]** against the exact OpenSSH version on the VM).

```
restrict,command="/usr/local/sbin/docs-gate prod" ssh-ed25519 AAAA...(masked) gha-docs-prod
restrict,command="/usr/local/sbin/docs-gate preview" ssh-ed25519 AAAA...(masked) gha-docs-preview
```

Gate (`/usr/local/sbin/docs-gate`, root:root 0755, POSIX sh; illustrative):

```sh
#!/bin/sh
set -eu
umask 022
case "${1:-}" in
  prod)    BASE=/srv/docs/prod;    RDIR=releases; ID_RE='[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}' ;;
  preview) BASE=/srv/docs/preview; RDIR=builds;   ID_RE='pr-[0-9]{1,6}-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}' ;;
  *) exit 64 ;;
esac
cmd=${SSH_ORIGINAL_COMMAND-}
logger -t docs-gate -- "$1: $(printf '%.200s' "$cmd")"
case "$cmd" in
  'rsync --server '*) exec /usr/bin/rrsync -wo -no-del -munge "$BASE/$RDIR" ;;  # rrsync re-reads SSH_ORIGINAL_COMMAND
esac
# Whole-string allow-list before any splitting; never eval or sh -c.
printf '%s' "$cmd" | LC_ALL=C grep -Eqx "(current|prune|rollback|activate $ID_RE|delete pr-[0-9]{1,6})" || exit 65
set -f; set -- $cmd          # safe: charset already restricted, globbing off
exec 9>"$BASE/.lock"; flock -w 600 9   # serialise control verbs
cd -- "$BASE"
# current  : print basename of readlink(current)
# activate : [ -d "$RDIR/$2" ] && [ ! -L "$RDIR/$2" ] && realpath is under $BASE/$RDIR;
#            ln -s -- "$RDIR/$2" .current.tmp && mv -T -- .current.tmp current   (preview: live/pr-N)
# rollback : activate newest id older than current
# prune    : keep newest 3 ids + current's target; rm -rf -- each other validated id
# delete   : preview only; rm live/pr-N and builds/pr-N-*
```

Input-validation requirements for the gate:

- Treat `SSH_ORIGINAL_COMMAND` as hostile. Match the **entire** string against an anchored allow-list (`grep -x`, `LC_ALL=C`, ASCII, bounded lengths) before splitting. Never pass it to `eval`, `sh -c`, `$(...)` or unquoted globbing.
- Release ids come from a fixed regex with no `/`, no `.`, no leading `-`. Pass `--` before path operands to `rm`, `ln`, `mv`.
- `activate` checks the target exists, is a directory, is not a symlink, and resolves under the releases dir.
- `prune` never deletes the current target or the newest (possibly in-progress) folder. Hold the lock so it cannot race an `activate`.
- The gate and its directory are root-owned and not writable by `deploy`. `deploy` owns only `/srv/docs/{prod,preview}`. nginx reads as its own user (files 644, dirs 755).
- Unknown input fails closed with a non-zero exit. Log every invocation to syslog (truncated).
- **The 14-day preview expiry should run on the VM**, not depend on CI firing. A systemd timer or cron as `deploy` can run `find /srv/docs/preview/builds -mindepth 1 -maxdepth 1 -mtime +14` plus removal of dangling `live/` links. PR-close workflows call `delete pr-N` for prompt cleanup. **[inference]**
- Hard-link safety: removing a release only unlinks names, so files shared with the live release are untouched. Linux `fs.protected_hardlinks=1` (default on Ubuntu/Debian) stops `deploy` from hard-linking files it does not own **[unverified on the target image]**.

## 3. `authorized_keys` options and `from=`

From sshd(8), AUTHORIZED_KEYS FILE FORMAT, https://man.openbsd.org/sshd.8 :

- `restrict`: "Enable all restrictions, i.e. disable port, agent and X11 forwarding, as well as disabling PTY allocation and execution of ~/.ssh/rc. If any future restriction capabilities are added to authorized_keys files, they will be included in this set." Individual re-enables exist (`pty`, `port-forwarding`, `agent-forwarding`, `X11-forwarding`); don't use them. `restrict` does **not** limit which command runs; that is `command=`.
- `command="..."`: "Specifies that the command is executed whenever this key is used for authentication. The command supplied by the user (if any) is ignored." It "applies to shell, command or subsystem execution", so `sftp`/`scp` also land in the gate. "The command originally supplied by the client is available in the SSH_ORIGINAL_COMMAND environment variable." A `ForceCommand` in sshd_config overrides it.
- `from="pattern-list"`: the client's canonical host name or IP must match. The list "may match IP addresses using CIDR address/masklen notation". Its purpose is to make a stolen key unusable from elsewhere unless the attacker also compromises name servers or routers. Name patterns need DNS; CIDR-only lists don't.
- `expiry-time="YYYYMMDD[Z]"` gives a hard key expiry; useful for scheduled rotation.
- **`from=` with GitHub-hosted runners is not practical.** GitHub: "The list of GitHub Actions IP addresses returned by the API is updated once a week." "we do not recommend that you use these as allowlists for your internal resources." Runners "are hosted in Azure and subsequently have the same IP address ranges as the Azure datacenters". For allow-listing "we recommend you use larger runners with a static IP address range, or self-hosted runners." https://docs.github.com/en/actions/reference/runners/github-hosted-runners . `GET https://api.github.com/meta` on 2026-10-19 returned **7,038** `actions` entries (5,510 IPv4). **[inference]** A line that size has to be regenerated weekly, and since it admits any Azure tenant it adds almost nothing. Options if source pinning is wanted: GitHub larger runners with static IPs (paid, org-level), a self-hosted runner, or a tunnel/bastion. Otherwise rely on key + forced command + gate, plus `MaxAuthTries`/fail2ban on the VM.

## 4. Host key pinning and key loading in the workflow

- ssh_config(5), https://man.openbsd.org/ssh_config.5 : `StrictHostKeyChecking yes` means ssh "will never automatically add host keys to the ~/.ssh/known_hosts file". `accept-new` and `no` add keys automatically (trust on first use / no check). `BatchMode yes` disables prompts. `IdentitiesOnly` uses only the configured identity. "UpdateHostKeys is enabled by default if the user has not overridden the default UserKnownHostsFile setting", so pointing `UserKnownHostsFile` at a temp file also stops host-key rotation writes.
- known_hosts format (sshd(8) SSH_KNOWN_HOSTS FILE FORMAT): for a non-standard port use `[host]:port`. Hashed names start with `|`.
- Get the host key **out of band**: on the VM console run `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` and build the line from the `.pub` file. Do not run `ssh-keyscan` inside the workflow; the webfactory README itself says `ssh-keyscan` without verification "is susceptible to man-in-the-middle attacks". https://github.com/webfactory/ssh-agent . Pin all host key types the server offers, or force `-o HostKeyAlgorithms=ssh-ed25519` to match the single pinned key.
- Suggested step (no third-party action):

  ```yaml
  - name: Deploy
    env:
      SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
      KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
      HOST: ${{ secrets.DEPLOY_HOST }}
    run: |
      umask 077
      printf '%s\n' "$SSH_KEY" > "$RUNNER_TEMP/id"
      printf '%s\n' "$KNOWN_HOSTS" > "$RUNNER_TEMP/kh"
      SSH="ssh -i $RUNNER_TEMP/id -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$RUNNER_TEMP/kh"
      prev=$($SSH deploy@"$HOST" current)
      rsync -rlc --no-times --omit-dir-times --chmod=D755,F644 -e "$SSH" \
        --link-dest="/$prev/" build/ deploy@"$HOST":"/$RELEASE_ID/"
      $SSH deploy@"$HOST" "activate $RELEASE_ID"
      $SSH deploy@"$HOST" prune
  - if: always()
    run: rm -f "$RUNNER_TEMP/id"
  ```
  
  (Illustrative. Handle the first deploy when `current` is empty, and quote carefully.) The runner VM is fresh per job ("each GitHub-hosted runner is a new virtual machine", runners page above), so the leftover-key risk is mostly a concern on self-hosted runners.
- If you prefer an agent, `webfactory/ssh-agent` (MIT) holds the key in memory ("never written to disk"), kills the agent in a post step, does not configure `known_hosts` for you, and logs the public key unless `log-public-key: false`. Latest tag `v0.10.0` → `e83874834305fe9a4a2997156cb26c5de65a8555` (GitHub API, 2026-10-19). Pin by that SHA.
- Supply chain, from https://docs.github.com/en/actions/reference/security/secure-use : "Pin references to actions to a commit SHA". "you should verify it is from the action's repository and not a repository fork". "a tag can be moved or deleted if a bad actor gains access to the repository storing the action". Dependabot version updates can bump SHA pins, but "will not create alerts for actions pinned to SHA values". The page also mentions action **lockfiles** as superseding SHA pinning; **[unverified]** what that feature requires, not researched. Set `GITHUB_TOKEN` to read-only by default ("set the default permission for the GITHUB_TOKEN to read access only for repository contents"). Don't put the key in structured (JSON/YAML) secrets, which can break log redaction.
- Secrets limits: 100 repository secrets, 100 environment secrets, 1,000 org secrets, 48 KB each. The lowest level wins on name clashes (environment > repo > org). https://docs.github.com/en/actions/reference/security/secrets

## 5. GitHub environments, branch rules and `workflow_run`

Reference: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments ; how-to: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments

- **Plans.** "Users with GitHub Free plans can only configure environments for public repositories." Further rules:
  - "If you are on a GitHub Free, GitHub Pro, or GitHub Team plan, required reviewers are only available for public repositories." Wait timers, custom protection rules and the admin-bypass setting have the same wording.
  - "If you are using GitHub Free, environment secrets are only available in public repositories." Private or internal repos need Pro, Team or Enterprise.
  - Deployment branches/tags work for all public repos, and for private repos on Pro/Team.
  - If a repo goes private, "any configured protection rules or environment secrets will be ignored".
  
  **For this public repo, every feature is available whatever WSO2's org plan.** **[unverified]** which plan the WSO2 org is on; it only matters if the repo is ever made private.
- **Limits.** Up to 6 users or teams as reviewers, and one approval is enough. "users who initiate a deployment cannot approve the deployment job" when prevent self-review is on. Wait timer is "an integer between 1 and 43,200 (30 days)". At most 6 protection rules per environment. Names are case-insensitive, ≤255 chars. No stated cap on environment count. **[unverified]** the maximum time a job waits for approval; not stated on the pages read.
- **Secrets gating.** "Secrets stored in an environment are only available to workflow jobs that reference the environment", and "a job cannot access environment secrets until one of the required reviewers approves it."
- **Admin bypass** is on by default ("administrators can bypass the protection rules"). Turn it off for `production`.
- **Branch rules.** "The deployment branch or tag rule is matched against the `GITHUB_REF` of the workflow run." Patterns follow Ruby `File.fnmatch`. "Protected branches only" also stops fork branches with matching names. Use "Selected branches and tags" = `main` and no tag rules.
- **`workflow_run` and a main-only rule.** For `workflow_run`, `GITHUB_SHA` is "Last commit on default branch" and `GITHUB_REF` is "Default branch". "The workflow started by the `workflow_run` event is able to access secrets and write tokens". It "will only trigger a workflow run if the workflow file exists on the default branch". Chains are capped at three levels. https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows . **So a `workflow_run` deploy job always satisfies a `main`-only environment rule**, including when the triggering run was a PR from a fork, and secrets are available to it. secure-use says: "Workflows triggered on `workflow_run` should treat artifacts uploaded from other workflows with caution." Implications **[inference]**:
  - **Production:** build and deploy in one `on: push: branches: [main]` workflow, as two jobs linked by `needs:` and an artifact. Then `GITHUB_REF` really is `refs/heads/main` and the rule means something. If `workflow_run` is used anyway, guard the job with:
    - `github.event.workflow_run.event == 'push'`
    - `github.event.workflow_run.head_branch == 'main'`
    - `github.event.workflow_run.head_repository.full_name == github.repository`
    - `github.event.workflow_run.conclusion == 'success'`
    
    Download the artifact by `run_id`. Add required reviewers on `production` as a second gate.
  - **Previews:** fork PRs get no secrets ("With the exception of `GITHUB_TOKEN`, secrets are not passed to the runner when a workflow is triggered from a forked repository"), so fork previews need `workflow_run`. Use a separate `preview` environment with the preview-only key (its own forced command and DIR). Treat the artifact as untrusted data: extract only into the upload dir, never execute anything from it. Serve previews from a **different hostname** than production so untrusted preview HTML/JS cannot run in the production origin. On a public repo, first-time contributors' PR workflows may need maintainer approval before running.
  - Add `concurrency: { group: docs-prod-deploy, cancel-in-progress: false }` so two deploys never interleave `activate`/`prune`. The gate's `flock` is the server-side backstop.

## Risks and open items

- `--checksum` without `-t` is the key to getting hard links from Docusaurus output. Prove it on the VM (`stat -c %h`) before sizing disk. If linking fails, 3 releases ≈ 30 GB, and each preview adds ~10 GB.
- Ubuntu 24.04 rrsync 3.2.7 vs the CVE-2026-53783 fix: check the distro security tracker, or use Debian 13 / a vendored 3.5.1 rrsync script (GPL-3.0, packaged as a separate file; **[inference]** no licence conflict for a deployment-host tool).
- A compromised deploy key can still deface the site or fill the disk (no quotas). Consider a filesystem quota or a separate volume for `/srv/docs`.
- Gate script and nginx config need peer review and a test pass before production.
