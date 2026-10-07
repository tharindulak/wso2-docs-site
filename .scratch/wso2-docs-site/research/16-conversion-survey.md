# Conversion survey: every product's docs (2026-10-07)

Method: sparse clone of each repo's default branch (Markdown and config only), render with the prototype converter using the repo's own `mkdocs.yml` variables (with `INHERIT`), expand `{!file!}` (markdown-include), `--8<--` (snippets) and `{{#var#}}`, rewrite MkDocs syntax, compile each page with MDX 3 + GFM + directives. Docusaurus repos compiled as is. Script: branch `prototype/conversion-survey`, `prototypes/content-format/scripts/survey.mjs`. Latest version only; older versions not measured.

| Product | Content source | Tool | Pages | Compile clean | Pages needing fixes | Notes |
|---|---|---|---|---|---|---|
| Agent Manager | docs-agent-platform | Docusaurus | 195 | 191 (98%) | 4 | Already Docusaurus; failures likely plugin differences (mermaid) |
| API Platform (cloud) | docs-api-platform | MkDocs | 1,071 | 1,059 (99%) | 12 | Separate tree from API Manager: needs [combining](../issues/15-combine-separate-doc-sets.md) |
| API Platform (self-hosted) | docs-apim | MkDocs | 595 | 496 (83%) | 99 | Invalid HTML; 49 `{!include!}` expanded, 1 missing |
| Kubernetes Gateway | docs-apk | MkDocs | 230 | 202 (88%) | 28 | 53 includes expanded |
| Integration Platform | docs-integrator | Docusaurus | 1,168 | 1,153 (99%) | 15 | Already Docusaurus |
| Integration Platform | docs-devant | MkDocs | 66 | 63 (95%) | 3 | Cloud tree: needs combining with docs-integrator |
| Integration Platform | docs-mi | MkDocs | 875 | 697 (80%) | 178 | Invalid HTML; 225 `{!include!}` expanded |
| Integration Platform | docs-bi | MkDocs | 102 | 100 (98%) | 2 | |
| Integration Platform | docs-si | MkDocs | 222 | 212 (95%) | 10 | |
| Integration Platform | docs-icp | MkDocs | 8 | 7 (88%) | 1 | One page uses an inline JSON expression |
| Identity Platform | docs-is (merged) | MkDocs | 1,016 | 874 (86%) | 142 | Measured in the content-format prototype; only repo with heavy cloud/self-hosted conditionals |
| Developer Platform | docs-choreo-dev (2 sites) | MkDocs | 263 | 248 (94%) | 15 | Developers and Platform Engineers doc sets |
| Accelerator for Healthcare | open-healthcare-docs | Docusaurus | 101 | 95 (94%) | 6 | Already Docusaurus |
| Accelerator for Financial Services | docs-open-banking | MkDocs | 179 | 169 (94%) | 10 | Duplicate `theme:` key in mkdocs.yml; 26 snippets expanded |
| Updates | docs-updates | MkDocs | 36 | 31 (86%) | 5 | |
| Platform Security | docs-security | MkDocs | 490 | 489 (100%) | 1 | Uses `{{#base_path#}}` (579 uses) instead of Jinja |
| API Analytics Platform | moesif.com | external | | | | Stays external |
| **Total** | 16 sources | | **6,617** | **6,086 (92%)** | **531** | |

Findings:
- Only docs-is relies on cloud/self-hosted Jinja conditionals (689); other MkDocs repos use plain variables (markdownextradata) and at most a handful of conditionals.
- Failures are overwhelmingly HTML that browsers tolerate but MDX rejects (unclosed or stray tags), concentrated in docs-mi (178), docs-is (142) and docs-apim (99). These go on each source's exclude list and get fixed in source ([Build-time conversion contract](../issues/13-conversion-contract.md)).
- The converter needs three more include/variable syntaxes than docs-is used: `{!file!}`, `--8<--`, `{{#var#}}`. Without them, content silently disappears while pages still compile, so the contract's check must fail on unexpanded include markers.
- Four sources already run Docusaurus 3.9/3.10 (agent-platform, integrator, healthcare); their remaining failures are likely their own plugins (mermaid, rehype), not real breakage.
- Limits: compile success is not visual correctness; sidebars still need building from each `nav:`; only Latest measured; image links not checked.
