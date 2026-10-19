# Search index and deploy path in the existing scripts

Parent: [map](../map.md)
Type: research (AFK)
Status: closed
Assignee: tharindulak (research agent)
Blocked by: 

## Question

Read `docs-site/scripts/search-index.mjs`, `snapshots.mjs`, `snapshot-store.mjs` and the existing workflows to answer: can the indexer build a new collection without moving the `docs` alias straight away (and what change it needs if not)? Does it drop older collections before or after the alias moves, and what happens to the previous release's index on rollback? What exactly must a deploy run, in order, from checkout to an assembled `site/build` with no missing snapshots, and how long and how much disk does each step take on a hosted runner? Can a `workflow_run` trigger on `docs-site snapshots` see which commit it built, and does a run with no new snapshots still fire? What does the build need to set `site.url` from an environment variable?

## Resolution

Findings: [03-search-index-and-deploy-path.md](../research/03-search-index-and-deploy-path.md).

- **Index without alias move:** not possible today; `publish()` in `search-index.mjs` creates, imports, moves the alias and drops every older collection in one call. Smallest change (about 40 lines): split into `index` (create and import, print the name), `promote <collection>` and `prune --keep N`. The site names the alias, so promoting needs no rebuild.
- **Rollback:** today the previous collection is already dropped, so a symlink rollback would search the new index. Fix: keep the previous collection, record its name in each release, rollback = symlink switch plus `promote`.
- **Deploy sequence:** checkout the exact commit, Node 22, `npm ci --ignore-scripts`, `fetch-sources.mjs`, `npm run content`, `npm run build`, `snapshots.mjs assemble` from the GitHub Release store without `--allow-missing`, `check-links` with baselines, then index and ship. Only measurements: 15 to 50 min build, 4.6 GB peak memory with Docusaurus Faster, indexing 1 to 2 min. Disk is the main risk: about 11 GB of output against about 14 GB free on the runner. No CI timings exist yet (Actions disabled on the fork, snapshot store release not created).
- **workflow_run:** the built commit is `github.event.workflow_run.head_sha` (check it out explicitly; `GITHUB_SHA` is the default branch head). With no missing snapshots the jobs are skipped and the run should still conclude `success` (unverified; confirm with a test run). Filter on `conclusion == 'success'`. The deploy workflow must live on the default branch.
- **site.url:** read a validated `DOCS_SITE_URL` at `docusaurus.config.js:85`; it drives canonical, `og:url`, sitemap and the DuckDuckGo fallback link. Search records are root-relative. Snapshots embed canonical and `og:url` too, but their key hashes the config file, not the env value: the snapshots workflow must set the same value, or the URL joins the key.
- **Surfaced:** the snapshots workflow triggers on `main` and `docs-site-versions` but the default branch is `docs-site-build`; bump PRs made with `GITHUB_TOKEN` may never start CI, snapshots or a deploy; the merged `sitemap.xml` lists live pages only; the fork is private, so its runner has 8 GB RAM.
