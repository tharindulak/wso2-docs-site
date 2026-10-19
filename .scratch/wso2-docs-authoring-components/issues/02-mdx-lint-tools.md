# What tools can check MDX for missing components

Parent: [map](../map.md)
Type: research
Status: closed
Assignee: tharinduj
Blocked by: 

## Question

Which tools can enforce, in a content repo's CI, that writers use a component instead of a hand-written pattern (e.g. a run of `## Step N:` headings outside `<Steps>`): remark-lint with remark-mdx and custom rules, markdownlint (MDX support?), Vale (MDX support), eslint-mdx, or extending this repo's own `wso2-docs check` (it already compiles MDX with `@mdx-js/mdx`). For each: MDX parsing quality (JSX, expressions, `.md` files compiled as MDX), custom-rule effort, messages with line numbers, editor integration, licence, maintenance, supply-chain risk. How GitLab (Vale, markdownlint, Danger), GitHub Docs and others enforce their components.

Research, 2026-10-14. Findings on branch `research/mdx-lint-tools` (commit 58d7e71), file `.scratch/wso2-docs-authoring-components/research/02-mdx-lint-tools.md`. Tools were tried in scratch directories only (remark, Vale 3.24.0 with checksum verified, ESLint with eslint-plugin-mdx), read-only against the docs-is tree.

## Answer

- **Recommended: extend `wso2-docs check` with a contract pass**: a remark plugin over the authored source with the parsers Docusaurus uses (remark-parse, remark-mdx, remark-gfm, remark-directive), already in the converter's lockfile through `@mdx-js/mdx` 3.1.1, so no new packages. It reuses the convention plugins' matchers, emits `::error file=,line=` annotations, honours `mdx.format: md`, and runs in the fork's CI via `docs-site/check-action`. Estimate 1 to 2 days with tests.
- **Best off-the-shelf: remark-lint with remark-mdx.** A 20-line rule caught every sample with file:line. On the tree (49 s): 909 Step headings outside `<Steps>` (277 in Latest), about 1,260 Prerequisites headings or admonitions, 10 Deprecated warnings, 73 imports; it could not parse 90 pages (the `mdx.format: md` ones). 250 packages; autofix only reformats whole files.
- **markdownlint does not support MDX** (maintainer closed it as not planned, issue #985): Markdown hygiene only.
- **Vale 3.24.0** parses MDX (since 3.18) and found the same 277 Step headings, but cannot see components, imports or front matter, and crashed on one 5.9.0 page, aborting the run. Keep for a future prose style guide.
- **eslint-plugin-mdx** works but adds nothing (Markdown rules still go through remark), 270 packages.
- **Others:** none uses an off-the-shelf MDX linter for component rules. GitLab: Vale, markdownlint, a script, a partial Hugo build for shortcodes. GitHub Docs: markdownlint with custom rules on changed files, errors block, warnings show. Microsoft Learn: a closed build-validation bot. Cloudflare: Semgrep and its own build linter as annotations; actions pinned by SHA.
- **The allowed-components list is wider than the seven:** the tree already uses `ApiReference` (509 uses), `Recommendation`, `Redirect`, `DbConfigTable` and others, some via imported partials.
- **Supply chain:** nothing copyleft; `spdx-exceptions` is CC-BY-3.0 (relevant only if a toolchain is redistributed). Pin actions by commit SHA (CVE-2025-30066).
- **Likely existing bug (read, not run):** `compileCheck` strips front matter and the Docusaurus path regenerates it, so compile-error line numbers probably count from after the front matter; the new pass should parse the raw source with front matter blanked.
- **For What the check enforces:** whether `mdx.format: md` pages skip the contract or new pages may not use it; the escape hatch (an MDX comment, or front matter like `stepper: false`).

