# Cloudflare hosting

The site's pages live in an R2 bucket, and `worker.js` serves them. Search stays on the docs VM (the kit in the parent
folder). The Deploy workflow (`.github/workflows/docs-site-deploy.yml`) publishes each build to the bucket in place:
non-HTML files first, then pages, then deletions. The bucket holds one copy of the site, about 10 GB with every
snapshot, which is what R2's free storage covers.

Why R2 and not Pages or Workers static assets: the full site has about 94,000 files, and those take 20,000 per
deploy on the free plan (100,000 on Workers Paid).

| File | |
|---|---|
| `worker.js` | Maps `/x/` to `x/index.html` like `scripts/serve.mjs`, redirects `/x` to `/x/`, serves `404.html`. Never serves dot files or `_search/`. Sends `X-Robots-Tag: noindex` while `NOINDEX` is `1`. Answers `/search-config.json` from `SEARCH_URL` and `SEARCH_KEY` when both are set. |
| `wrangler.toml` | Worker name, bucket binding (`SITE` = `wso2-docs-site`), `NOINDEX`, `SEARCH_URL`. |

## Free plan limits that matter

Check https://developers.cloudflare.com before relying on these.

| Limit | Use |
|---|---|
| R2 storage, 10 GB a month | One copy of the site. A second copy (a staging prefix, kept releases) goes over. |
| R2 Class A (writes, lists), 1M a month | A deploy uploads every changed Latest page and asset, roughly 10,000 to 15,000 files. Above 1M: $4.50 per million. |
| R2 Class B (reads), 10M a month | One per file a visitor loads; capped in practice by the next row. |
| Workers requests, 100,000 a day | One per file a visitor loads. Hashed `/assets/` files are cached by browsers for a year. Above the limit visitors get Cloudflare error 1027 until midnight UTC. |

## One-time setup

1. **Bucket:** in the Cloudflare dashboard, R2: create bucket `wso2-docs-site`, Standard storage class, public access off.
2. **Upload token:** R2, Manage API tokens: Object Read & Write, this bucket only. Put the Account ID, Access Key ID and
   Secret Access Key in the GitHub environment as `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Set
   the repository variable `R2_BUCKET` to `wso2-docs-site`.
3. **Worker:** from this folder, `npx wrangler@4.148.0 login`, then `npx wrangler@4.148.0 deploy`. It prints the
   address (`https://wso2-docs-site.<subdomain>.workers.dev`). Set the repository variable `DOCS_SITE_URL` to it.
   `DOCS_SITE_URL` is part of every snapshot key, so run the snapshots workflow before the next deploy.
4. **Search:** the VM's search host must be public over HTTPS and allow the Worker's address:
   `setup.sh apply ... --search-url https://search.<vm host> --cors-origin <Worker address>` (parent folder's
   README). Then set `SEARCH_URL` in `wrangler.toml` and the search-only key (from the VM's
   `/etc/docs-site/typesense.env`, `TYPESENSE_SEARCH_KEY`; never the admin key) with
   `npx wrangler@4.148.0 secret put SEARCH_KEY`, and deploy the Worker again.

The Worker only needs deploying again when `worker.js` or `wrangler.toml` changes, not for content.

## Rollback

There is one copy, so rollback is a deploy: dispatch the Deploy workflow with an older commit of the default branch.
It rebuilds and republishes that commit (about as long as any deploy) and indexes its search records.

## Moving to another Cloudflare account

Repeat the setup there, deploy once, then add a custom domain under Workers, `wso2-docs-site`, Settings, Domains &
Routes (the domain must be a zone in that account). Update `DOCS_SITE_URL` (snapshots rebuild) and the VM's
`--cors-origin`. Delete the old bucket and Worker afterwards.
