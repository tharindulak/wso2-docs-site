# VM facts and deploy access

Parent: [map](../map.md)
Type: task (HITL)
Status: open
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
