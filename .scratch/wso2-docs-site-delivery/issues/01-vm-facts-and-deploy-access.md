# VM facts and deploy access

Parent: [map](../map.md)
Type: task (HITL)
Status: closed
Assignee: tharindulak
Blocked by: 

## Question

Record the VM as it is configured today and set up deploy access, so the hosting and deploy specs work from facts. Checklist for the user: hostname(s) and whether a preview hostname can be added; OS and version; nginx version and current server blocks; TLS (certbot or other) and who renews it; free disk (a release is about 10 GB; 3 releases with `--link-dest` plus previews plus Typesense, which holds about 350 MB of index); RAM and CPU (Typesense runs here too); whether Docker is installed; SSH port and firewall rules for GitHub-hosted runner IPs. Then create the `deploy` user (no sudo) owning only the releases folder, generate its key pair, and record where the private key, host and known_hosts are kept (never in the repo or this ticket). Resolution lists the facts and the secret names, not their values.

## Added after [Release folders, rsync and restricted SSH on the VM](04-release-pattern-on-the-vm.md)

Also record: exact rsync version (and whether the distro has patched the reported rrsync escape), `sysctl fs.protected_hardlinks`, whether `open_file_cache` is set in nginx, and the host key line read from the VM console (not `ssh-keyscan`).

## Facts gathered (2026-10-20)

Read-only, over SSH as the image's default admin user. The address, hostname and keys are kept out of this repo.

- **Host:** Oracle Cloud instance, Ubuntu 24.04.5 LTS, x86_64, 2 vCPU, **954 MiB RAM, no swap**, 45 GB disk (42 GB free).
- **Web server:** **Caddy, not nginx** (nginx not installed). One site block for the VM's `sslip.io` hostname, `root * /var/www/site`, `file_server`, automatic HTTPS. Ports 80 and 443 owned by Caddy.
- **Docker:** not installed.
- **rsync:** 3.2.7 (`3.2.7-1ubuntu1.5`), `rrsync` at `/usr/bin/rrsync`. Whether this build carries the fix for the rrsync escape reported in [Release folders, rsync and restricted SSH on the VM](04-release-pattern-on-the-vm.md) is unverified.
- **Kernel:** `fs.protected_hardlinks = 1`.
- **sshd:** port 22, key only (`passwordauthentication no`), `permitrootlogin without-password` (root may log in with a key).
- **Firewalls:** OCI Security List allows 22, 80, 443 from `0.0.0.0/0`; iptables allows 22, 80, 443 and rejects the rest.
- **Earlier VM:** a VM created 2026-10-16 times out on port 22 from the user's network while 80 and 443 answer; not used for this map.

## Decisions so far on this ticket (2026-10-20, user)

- **Keep Caddy**, replacing the charting decision for nginx: automatic HTTPS, `try_files {path} {path}/index.html` for dotted segments, the `current` symlink read per request with no reload. The nginx specifics in [Release folders, rsync and restricted SSH on the VM](04-release-pattern-on-the-vm.md) must be rechecked for Caddy in the hosting spec.
- **More RAM, on a new Arm VM:** 954 MiB cannot hold Typesense (about 350 MB of index plus headroom). The user creates a new Ubuntu 24.04 Ampere A1 instance (likely Always Free; x86 to Arm cannot change in place), opens 22, 80, 443 and installs Caddy; this VM is then retired. Docker is installed there.
- **Preview hostnames:** subdomains of the VM's sslip.io hostname, each with its own Caddy certificate. Risks: depends on sslip.io (free third-party DNS); Let's Encrypt per-domain limits, so previews reuse names.
- **Root SSH login off:** `PermitRootLogin no`.
- **Who changes the VM:** the agent runs each reviewed command list over SSH. Deploy key generated on the user's Mac, never printed or committed. GitHub secrets set only after a separate approval.

## Facts: the new Arm VM (2026-10-20)

Replaces the 1 GB VM above. Read-only, over SSH as the image's default admin user.

- **Host:** OCI Ampere A1, Ubuntu 24.04.5 LTS, **aarch64**, 4 OCPU, **23 GiB RAM**, no swap, 45 GB disk (42 GB free).
- **Web server:** Caddy on 80 and 443, one site block for the VM's sslip.io hostname, `root * /var/www/site`, `file_server`; HTTPS answers 200.
- **Same as before:** no Docker; rsync 3.2.7 (`3.2.7-1ubuntu1.5`) with `/usr/bin/rrsync`; `fs.protected_hardlinks = 1`; sshd key only with `permitrootlogin without-password`; Security List and iptables allow 22, 80, 443.
- **Arm:** the Typesense image in `search/compose.yaml` is pinned by digest; whether that digest covers arm64 is for the hosting spec to check.
- **Host key (ED25519):** `SHA256:i857mhRVs9gtXskfw4iuLBdn1sVYrzNpwITtmYrGEi8`, to be confirmed against the OCI console before it becomes the `known_hosts` secret.

## Deploy access set up (2026-10-20)

Run by the agent over SSH after the user approved the command list.

- **`deploy` user:** no sudo, password locked, shell `/bin/bash` (needed for the forced command).
- **Folders:** `/srv/docs`, `/srv/docs/releases`, `/srv/docs/previews`, owned by `deploy`, mode 755. Caddy still serves `/var/www/site`; repointing it is for [Hosting config for Caddy and Typesense](08-hosting-config-caddy-and-typesense.md).
- **Deploy key:** a new ed25519 key with no passphrase, generated on the user's Mac and kept in the user's VM keys folder (not in this repo); fingerprint `SHA256:g0b0rwdL1bjAH+D75KBD4NaWpA5Q3MBqfUv6TBifC2M`. Its `authorized_keys` line: `restrict,command="/usr/bin/rrsync -wo -no-del -munge /srv/docs/releases"`.
- **Root SSH login off:** `/etc/ssh/sshd_config.d/99-docs-hardening.conf` with `PermitRootLogin no`, validated with `sshd -t`; `sshd -T` reports `permitrootlogin no`.
- **Checks (GNU rsync 3.5.1 client):** admin login still works; root refused; `id` and `ls /` with the deploy key refused by rrsync; upload into `releases/probe` works; `../previews`, read-back and `--delete` refused; an absolute path is confined under `releases/`. The probe was removed.
- **Finding for the deploy spec:** without `-p`, uploaded folders kept the source's 0700 mode, which Caddy could not read. The deploy must set modes explicitly, e.g. `--chmod=D755,F644`.
- **Still open:** the user confirms the host key against the OCI console; the deploy key, host and `known_hosts` go into the `test` environment as secrets only after a separate approval. Proposed secret names: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`.

## Secrets (2026-10-20)

- GitHub environment `test` on this fork, deployments limited to the default branch `docs-site-build`.
- Secrets set by the user: `DEPLOY_SSH_KEY` (the deploy private key) and `DEPLOY_HOST` (the VM's IP, so SSH from CI does not depend on sslip.io DNS).
- `DEPLOY_KNOWN_HOSTS` waits for the user to confirm the ED25519 host key against the OCI console.
- `DEPLOY_KNOWN_HOSTS` set by the user (2026-10-20T09:12Z) from the first-connect `known_hosts` line, ED25519 `SHA256:i857mhRVs9gtXskfw4iuLBdn1sVYrzNpwITtmYrGEi8`, after the console check.

## Resolution

The test VM is an OCI Ampere A1 (Ubuntu 24.04, aarch64, 4 OCPU, 23 GiB) serving its sslip.io hostname with Caddy. Decisions on the way: keep Caddy instead of nginx; a larger Arm VM so Typesense fits; previews on sslip.io subdomains; root SSH login off. Deploy access: a `deploy` user without sudo owns `/srv/docs/{releases,previews}`; its ed25519 key is limited to `rrsync -wo -no-del -munge /srv/docs/releases`, checked end to end. Secrets on the `test` environment (default branch only): `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`. For the deploy spec: set file modes explicitly (`--chmod=D755,F644`); the gate script for switch, prune, rollback and preview cleanup still has to be written and installed; Caddy still serves `/var/www/site`. Retire the two earlier VMs in the OCI console when convenient.
