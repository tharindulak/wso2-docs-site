# Measure conversion of older versions

Parent: [map](../map.md)
Type: research
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

Run the current `@wso2/docs-converter` over the oldest, a middle and the newest-but-one version of each versioned content source (at least docs-is 5.9.0 and 6.x, docs-apim 3.0.0 and 4.0.0, docs-mi 4.2.0, docs-apk 1.0.0). What share compiles clean, which failures are new compared with Latest (older MkDocs layouts, missing `INHERIT`, theme config moved, old include syntax), and which need converter changes versus exclude lists? Compare with the [Latest conversion survey](../../wso2-docs-site/research/16-conversion-survey.md).

## Answer

2026-10-09. Full findings: [research/03-older-version-conversion.md](../research/03-older-version-conversion.md).

- 12 older versions (apim 3.0.0, 4.0.0, 4.6.0; mi 4.2.0, 4.5.0; apk 1.0.0, 1.3.0; si 4.3.0, 4.4.0; is 5.9.0, 6.1.0, 7.2.0): 6,830 pages, 6,815 convert (99.8%), 96.7% as strict MDX; the rest fall back to CommonMark, at the same rate as Latest re-measured with the same converter.
- No new failures from older MkDocs layouts: every version has `nav:`, the Material theme and known include syntax; only IS 7.x uses `INHERIT`, as Latest does.
- New class needing a converter change: IS 5.9.0 to 5.11.0 enable no templating plugin, yet the converter renders Jinja, so 5 pages fail and 8 silently lose `{{placeholder}}` text. Render Jinja only when `markdownextradata` or `macros` is enabled.
- Everything else goes on exclude lists: 0 to 1 page per non-IS version (missing include targets, one broken `{{- else }}`), 3 to 4 per IS version.
- Links to each version's own current site (569 in apim 4.0.0, mostly images) stay external; per-version prefixes and asset rewriting belong in the lock-file schema (ticket 06).
