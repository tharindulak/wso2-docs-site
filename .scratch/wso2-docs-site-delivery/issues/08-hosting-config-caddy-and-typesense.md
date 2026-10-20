# Hosting config for Caddy and Typesense

Parent: [map](../map.md)
Type: grilling (HITL)
Status: closed
Assignee: tharindulak
Blocked by: 01, 02, 04

## Question

Specify what lives in this repo and is applied by hand on the VM: the Caddyfile site blocks for the site, previews (subdomains of the sslip.io hostname, on-demand certificates within Let's Encrypt limits) and search (root on the `current` symlink, `try_files {path} {path}/index.html` for dotted segments, recheck the symlink and caching behaviour found for nginx, 404 page, cache headers, security headers including a Content-Security-Policy with the search host in `connect-src`, no directory listing, preview `noindex`), Typesense's compose setup (port not exposed, data volume, CORS set to the site origin, admin key on the VM and in CI only, search-only key in the browser), and how the config is applied and checked.

## Resolution

Decided with the user, 2026-10-20.

- **Web server out of this ticket.** The Caddy on the test VM is a temporary test setup the user manages; its config (and the production web server) is not specified here. What Deploy and Preview expect of it is listed under the map's **Not yet specified**.
- **Typesense on the VM:** Docker Engine from Docker's official apt repository; the repo's compose file adapted for the VM (pinned `typesense/typesense:30.2` digest, a multi-arch list with arm64); bound to `127.0.0.1:8108` only; data in a named volume; admin and search-only keys generated on the VM into a root-only env file readable by the gate, never in the repo or GitHub; `TYPESENSE_RESET_PEERS_ON_ERROR` kept (any release rebuilds the index); container memory limit 8 GB. The gate writes `search-config.json` (public search-only key, search hostname, alias `docs`) into each release.
- **Kept in the repo:** `docs-site/hosting/` holds the VM compose file, the gate script and an idempotent `setup.sh` (Docker, Typesense, gate, the gate key's `authorized_keys` line); `setup.sh --check` reports drift. The agent runs it over SSH after the user reviews it (user decision). Writing these files is hand-off work, not part of this map.
