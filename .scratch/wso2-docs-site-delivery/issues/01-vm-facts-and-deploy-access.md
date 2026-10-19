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
