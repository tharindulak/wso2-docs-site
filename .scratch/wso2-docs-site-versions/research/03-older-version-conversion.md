# Older-version conversion with the current converter (2026-10-09)

Answers [ticket 03](../issues/03-measure-older-version-conversion.md). Compares with the [Latest conversion survey](../../wso2-docs-site/research/16-conversion-survey.md).

## Method

- Sources: shallow (`--depth 1`), blob-filtered, sparse clones of `wso2/<repo>` into the session scratchpad, never inside this repo. Only `en/` (docs-is: the version folders plus `en/includes`, `en/base.yml`, `en/theme`, `is_common.yml`). Images, PDFs and archives left out of the checkout. Git hooks disabled; nothing from the fetched repos was executed.
- Refs: release branches `docs-apim` 3.0.0 (`53584be`), 4.0.0 (`5a85a65`), 4.6.0 (`d74917b`); `docs-mi` 4.2.0 (`840cd49`), 4.5.0 (`f62217f`); `docs-apk` 1.0.0 (`83d175c`), 1.3.0 (`7dbf573`); `docs-si` 4.3.0 (`09e25e7`), 4.4.0 (`da39e8c`); `docs-is` master `c2176fc` folders `en/identity-server/5.9.0`, `6.1.0`, `7.2.0`. Latest baselines re-measured at the commits pinned in `docs-site/content-sources.yaml` (apim `e4e26c4`, mi `ce68011`, apk `1566091`, si `9c75a97`, is 7.3.0 `c2176fc`).
- Converter: `@wso2/docs-converter` 0.1.0 as built in `docs-site/packages/docs-converter/dist` (dist newer than every `src` file; no rebuild, no source change). `wso2-docs check --root <clone> --config <cfg> --format json` per version, with a config kept outside the clone (`kind: mkdocs`, `mkdocs: en/mkdocs.yml` or the IS version's `mkdocs.yml`, `deployment_options: [Self-hosted]`, empty exclude list). A second pass called the library's `convertSource` (same code path as the CLI) to write output for inspection: CommonMark fallbacks, leftover syntax, nav coverage, absolute links.
- docs-is versions are run as plain self-hosted MkDocs sites (not `mkdocs-merge`); older IS versions have no Asgardeo counterpart.
- Run time: 6 to 31 s per version on a laptop.

"Converts" below means the CLI's own pass/fail: the page renders, passes the HTML policy and compiles as MDX 3 or, as last resort, as CommonMark (`mdx.format: md`, components show as plain content). "Strict MDX" excludes those CommonMark fallbacks.

## Results

| Content source | Version | Pages | Converts | Converts % | Fail | Strict MDX % | CommonMark fallback | In nav | Nav entries dropped |
|---|---|---|---|---|---|---|---|---|---|
| docs-apim | 3.0.0 (oldest) | 382 | 382 | 100.0 | 0 | 96.6 | 13 | 324 | 0 |
| docs-apim | 4.0.0 (middle) | 1,398 | 1,398 | 100.0 | 0 | 95.5 | 63 | 1,228 | 2 |
| docs-apim | 4.6.0 (newest but one) | 578 | 577 | 99.8 | 1 | 95.0 | 28 | 532 | 0 |
| docs-apim | Latest 4.7.0 | 595 | 594 | 99.8 | 1 | 95.1 | 28 | 547 | 2 |
| docs-mi | 4.2.0 (oldest) | 631 | 630 | 99.8 | 1 | 98.3 | 10 | 614 | 1 |
| docs-mi | 4.5.0 | 834 | 834 | 100.0 | 0 | 97.6 | 20 | 801 | 1 |
| docs-mi | Latest | 875 | 875 | 100.0 | 0 | 97.7 | 20 | 842 | 1 |
| docs-apk | 1.0.0 (oldest) | 133 | 133 | 100.0 | 0 | 92.5 | 10 | 85 | 0 |
| docs-apk | 1.3.0 | 252 | 251 | 99.6 | 1 | 91.7 | 20 | 171 | 1 |
| docs-apk | Latest | 230 | 230 | 100.0 | 0 | 93.0 | 16 | 156 | 0 |
| docs-si | 4.3.0 (oldest) | 233 | 233 | 100.0 | 0 | 99.6 | 1 | 193 | 0 |
| docs-si | 4.4.0 | 222 | 222 | 100.0 | 0 | 100.0 | 0 | 186 | 0 |
| docs-si | Latest | 222 | 222 | 100.0 | 0 | 100.0 | 0 | 186 | 0 |
| docs-is | 5.9.0 (oldest with source) | 563 | 558 | 99.1 | 5 | 95.7 | 19 | 541 | 7 |
| docs-is | 6.1.0 | 786 | 782 | 99.5 | 4 | 97.8 | 13 | 560 | 0 |
| docs-is | 7.2.0 (newest but one) | 818 | 815 | 99.6 | 3 | 98.3 | 11 | 749 | 3 |
| docs-is | Latest 7.3.0 | 851 | 848 | 99.6 | 3 | 98.4 | 11 | 779 | 3 |
| **Older versions** | 12 | **6,830** | **6,815** | **99.8** | **15** | **96.7** | **208** | | |

Pages = every `.md` under the site's `docs_dir`, as the converter walks them (includes folders and orphan pages count; "In nav" is the subset the sidebar reaches). apim 4.0.0 is the largest single version (1,398 pages, 357 under `reference/`).

Older versions convert at the same rate as Latest under the current converter. The survey's lower Latest numbers (apim 83%, mi 80%, is 86%) came from the prototype script (`prototypes/content-format/scripts/survey.mjs`, MDX only); the package since gained the HTML-block JSX rewrite and the CommonMark fallback, which absorb nearly all of those failures, in every version measured.

## Failures and what each needs

| Failure | Where | Same class as Latest? | Remedy |
|---|---|---|---|
| Missing include target (`includes/build-and-run.md`, `includes/streaming/enable-publishing.md`, `quick-starts/android.md`, `quick-starts/windows.md`, `./includes/deploy-travelocity.md`) | mi 4.2.0 (1), apim 4.6.0 (1), is 6.1.0 (3) | Yes (apim Latest has the same page) | Exclude list |
| Literal placeholder in a markdown-include marker: `{!insert-fragment!}` | is 6.1.0 (1) | New, single page | Exclude list |
| Broken Jinja in source: `{{- else }}` instead of `{%- else %}` | apk 1.3.0 (1) | New, fixed in Latest | Exclude list (frozen branch) |
| Ternary and `set` block, include from `next/` | is 7.2.0 (3) | Yes, identical to the Latest exclude list | Exclude list |
| **Templating applied to a site that never templated**: IS 5.9.0 has neither `markdownextradata` nor `macros`, so MkDocs printed `{{user-name}}`, `{{token}}`, `{{user.claim.givenname}}` literally. The converter always renders Jinja: 5 pages fail (`Unsupported expression: user-name`, `tenant Id`, `send-to`) and **8 pages convert but silently lose placeholders** (for example `configuring-totp.md` becomes "Hi , Please use the token  as the password"). | is 5.9.0; also 5.10.0 and 5.11.0 (same `mkdocs.yml` check, not converted) | **New** | **Converter change**: render Jinja only when the site's `mkdocs.yml` enables `markdownextradata` or `macros`; otherwise treat `{{ }}` and `{% %}` as literal text (escaped for MDX). An exclude list cannot catch the 8 silent pages. |
| Absolute links to the version's own current site, mostly images (`https://apim.docs.wso2.com/en/4.0.0/assets/img/...`) | apim 4.0.0: 569 links on 72 pages (from 45 source occurrences multiplied by includes); is 6.1.0: 4; is 5.9.0: 4 | Same class as Latest (mi Latest has 83 to `/en/4.7.0`), much larger in apim 4.0.0 | Site/converter change when old sites retire: `rewriteSiteLinks` only rewrites page links whose prefix is a section's current site or alias, and leaves asset URLs external. Each version needs its own prefix (for example `https://apim.docs.wso2.com/en/4.0.0/`), and asset links need rewriting too. Not a page failure, so the exclude list does not see it. |

Not found in any measured version: `pages:` instead of `nav:`, missing or changed `INHERIT`, a different theme layout, unknown include syntax or unexpanded include markers. Every older `mkdocs.yml` has `nav:` and `theme: name: material`; only IS 7.x uses `INHERIT` (as Latest does). apim 3.0.0 has no `markdown_include` or `snippets` at all; that converts fine. Old `extra.base_path` values are absolute URLs (`https://apim.docs.wso2.com/en/3.0.0`); the converter overrides `base_path` with the section route, so these become internal links as intended.

Leftover MkDocs syntax (`!!!`, `???` lines left as text, usually right after an admonition or inside lists) appears in 0 to 18 pages per version, at the same rate as Latest (apim 3.0.0: 2, mi Latest: 18). Pre-existing converter gap, not version specific.

## Recommendation

- One converter change before converting IS 5.9 to 5.11: honour whether the MkDocs site enables a templating plugin. Small, testable, and it prevents silent content loss.
- Everything else is per-version exclude lists: 0 to 1 page per older non-IS version (3 pages across 9 versions) and 3 to 4 per IS version once the templating fix lands; the classes match what Latest already needs.
- Per-version link prefixes (and asset URLs) for `rewriteSiteLinks` belong to the version lock-file schema ([ticket 06](../issues/06-lock-file-schema.md)), since they matter once the current sites retire.
- Expect CommonMark fallbacks at the Latest rate (about 3% of pages); these keep pages on the site but lose tabs and labelled blocks.

## Limits

- Converter compile check only. No Docusaurus build, so link and image processing failures (README: "a page can pass the check and still fail the site build") are not measured; images were not fetched.
- Versions in between (apim 3.1 to 4.5, mi 4.3 to 4.4, apk 1.1 to 2.0, si 4.3.1, is 5.10, 5.11, 6.0, 7.0, 7.1) were not converted; the plugin check for IS 5.10, 5.11, 6.0, 7.0, 7.1 was read from their `mkdocs.yml` only.
- docs-is versions run as self-hosted only; how older IS versions sit next to the merged Latest section is a separate question.
- Leftover-syntax counts come from a line regex over converter output (outside code fences) and may include a few false positives.
