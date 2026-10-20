# Hosting config for Caddy and Typesense

Parent: [map](../map.md)
Type: grilling (HITL)
Status: open
Assignee:
Blocked by: 01, 02, 04

## Question

Specify what lives in this repo and is applied by hand on the VM: the nginx server blocks for the site, previews and search (docroot on the `current` symlink, `try_files $uri $uri/index.html` for dotted segments, 404 page, cache headers, security headers including a Content-Security-Policy with the search host in `connect-src`, no directory listing, preview `noindex`), Typesense's compose setup (port not exposed, data volume, CORS set to the site origin, admin key on the VM and in CI only, search-only key in the browser), and how the config is applied and checked.
