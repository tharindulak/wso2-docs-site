# Locking down authored MDX: what a content-repo check must reject

Parent: [map](../map.md)
Type: research
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

Once writers author MDX directly, the [Build-time conversion contract](../../wso2-docs-site/issues/13-conversion-contract.md)'s HTML allow-list no longer covers everything: MDX adds `import`, `export`, JS expressions in `{…}`, and arbitrary JSX components. Using MDX 3 and Docusaurus 3 primary sources, plus how other public docs repos lint MDX (remark-lint, eslint-plugin-mdx, Docusaurus's own options such as `format: md` versus `mdx`), find what a pre-merge check can reliably reject and allow: allowed imports (partials only), allowed components, expressions, ESM exports, raw HTML. Also: what does it cost to keep the check and the docs-site build on the same rules?

## Answer

Research, 2026-10-13. Findings on branch `research/mdx-authoring-risks` (commit 3673d1d), file `.scratch/wso2-docs-is-migration/research/03-mdx-authoring-risks.md`.

- **Risk:** MDX expressions and exports run at build time in the docs-site Node process (Docusaurus evaluates pages with Node globals and `require`), so authored MDX reaches the build's filesystem, network and CI secrets, then runs in readers' browsers. The current regex HTML policy catches none of the tested MDX vectors (`href={"java"+"script:"}`, spread `onClick`, `dangerouslySetInnerHTML`, `{globalThis…}`, `export function`, `!!raw-loader!` imports, unknown components). Converted pages are safe today only because the converter escapes `{` and falls back to CommonMark.
- **Reliably rejectable on the parsed MDX tree, without running anything:** every `export`; every expression except `{/* comment */}`; imports outside an exact list (`@theme/Tabs`, `@theme/TabItem`, `Applies`, `DeploymentValue`, `ApiReference`, relative `_*.mdx` partials inside the repo, no `!`/`?`/`#`); unlisted capitalised or dotted components (including `Head`); the existing forbidden tags in lower-case JSX; spreads, `on*`, `dangerouslySetInnerHTML`, `ref`, `srcDoc`, non-literal attribute expressions; unsafe URLs in literal attributes (literal `href={"javascript:…"}` included).
- **Allowable:** listed components with literal props, `style={{…}}` objects, Markdown, lower-case HTML-as-JSX within the allow-list.
- **Not decidable, so forbidden:** non-literal JavaScript. Allowed components need their own review; `ApiReference`'s `spec` must resolve inside the repo.
- **Mechanism:** one remark plugin in `@wso2/docs-converter`, run by the `check` CLI and Action and registered in `docusaurus.config.js` under `beforeDefaultRemarkPlugins`, so the build enforces the same rules and an auto-merged bump cannot skip them. No new dependencies. eslint-plugin-mdx and remark-lint are fine for style, not as the security boundary.
- **Parity costs:** forbid `{#id}` heading IDs and `<!-- -->` comments and set `mdx1Compat` off; test that the converter's pinned `@mdx-js/mdx` 3.1.1 matches the Docusaurus loader's; the fork's CI pins the unpublished converter by SHA; generate the guide's component list from code.
- **Open, needs testing:** whether an error thrown in a remark plugin fails `docusaurus build` with the file named. **Security review needed:** the converter does not escape a `{` that opens `{/*`; one bypass attempt fell back to CommonMark, but safety is unproven. This affects every product converted at build time, not only docs-is.
