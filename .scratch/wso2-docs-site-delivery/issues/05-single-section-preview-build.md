# Building one section at a chosen ref

Parent: [map](../map.md)
Type: research (AFK)
Status: closed
Assignee: tharindulak (research agent)
Blocked by: 

## Question

Can the build produce one section's Latest with that section's pin overridden by a branch, tag or SHA, without the rest of the site? Check `DOCS_SITE_LOCK`, `fetch-sources.mjs`, `build-sections.mjs` and `build-content.mjs` for an existing path; list the changes needed if none. What does such a build need for the site chrome (home page, navigation, other sections' links, which will break), what `baseUrl` and `site.url` it should use on a preview host, and how long and how large it is for a small section and for the largest one (API Manager)? A ref from a content repo is untrusted input: note what must be validated (ref format, repo fixed by the lock, never a fork URL).

## Resolution

Findings: `research/05-single-section-preview-build.md` on branch `research/single-section-preview-build` (commit af500c4).

- **One-section build exists:** `fetch-sources.mjs <id>`, `build-content.mjs <id>`, `build-sections.mjs build <id>` (sets `DOCS_SECTIONS`) build only that section's Latest into `site/build-quick`.
- **Ref override:** write a temp lock with only that section's Latest SHA changed (structured edit, not `sed`: SHAs repeat across entries) and point `DOCS_SITE_LOCK` at it (`lib.mjs:11`). Verified locally on healthcare; the committed lock untouched. Merged and cloud-companion sections have two sources: which one the ref overrides is undecided.
- **Measured locally (16 GB Mac, warm caches):** healthcare 103 pages, about 17 s total, 1.4 GB peak, 81 MB output; API Manager 794 pages, about 80 s, 3.3 GB peak, 914 MB output. CI estimate (unverified): under 5 min small, 10 to 20 min API Manager.
- **Chrome and links:** home, account hub, search and 404 always build; the Products menu, footer and home cards link to every product, so `check-links.mjs` fails (438 broken for healthcare, 428 from chrome). The preview needs a link gate limited to the section's route, or none. Keep `baseUrl: '/'` with one hostname per preview (redirects, `versions.json`, content links are root-relative); `url` from an env var; `noIndex: true`.
- **Security (verified):** GitHub serves fork-only commits through the parent repo URL; a `tharindulak/docs-apim`-only SHA fetched from `wso2/docs-apim`, and the HEAD==SHA check in `fetch-sources.mjs` does not catch it. Accept branch or tag names resolved with `git ls-remote` against the lock's repo, or a SHA only after a reachability check against a branch of that repo; inputs through `env:` only; strict ref allow-list; build job read-only with no secrets.
- **Surfaced:** with `CI` set, `readLock()` rejects the committed lock because 17 sources pin `tharindulak/*` forks, so no CI run works today.
