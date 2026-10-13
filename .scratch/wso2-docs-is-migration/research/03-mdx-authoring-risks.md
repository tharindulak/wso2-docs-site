# Locking down authored MDX: what a content-repo check must reject (2026-10-13)

Ticket: [03 Locking down authored MDX](../issues/03-mdx-authoring-risks.md). Parent: [map](../map.md). Contract: [Build-time conversion contract](../../wso2-docs-site/issues/13-conversion-contract.md).

Method: read the MDX 3 and Docusaurus 3 docs, the mdast utility readmes, eslint-mdx and remark-lint; read the docs-site converter (`html-policy.ts`, `page.ts`, `syntax.ts`, `rehype-valid-elements.ts`), `check-action/action.yml` and Docusaurus 3.10.2 in `docs-site/node_modules`; ran a throwaway probe (not committed) that parses inputs with `remark-parse` + `remark-mdx` 3.1.1 (the copy `@mdx-js/mdx` 3.1.1 uses), compiles them with `@mdx-js/mdx`, and runs them through the existing `applyHtmlPolicy`. Findings are planning input for human and security review, not a vetted design.

## 1. Why the HTML allow-list stops being enough

- **MDX is code.** The MDX security note: "MDX is a programming language. If you trust your authors, that's fine. If you don't, it's unsafe." and "Do not let random people from the internet write MDX." ([mdxjs.com getting started, Security](https://mdxjs.com/docs/getting-started/#security)). Braces hold JavaScript: "Expressions can contain whole JavaScript programs as long as they're (wrapped in) an expression that evaluates to something that can be rendered", and MDX "supports `import` and `export` statements" ([What is MDX](https://mdxjs.com/docs/what-is-mdx/)).
- **It runs in the build, not only in the browser.** Docusaurus statically renders every page; its docs call this "a sandbox called React DOM Server" with "no `window` or `document`" ([Static site generation](https://docusaurus.io/docs/advanced/ssg)). That is not a security sandbox: in 3.10.2, `@docusaurus/core/lib/ssg/ssgRenderer.js` evaluates the server bundle with the `eval` package, `includeGlobals: true`, and a real `module.createRequire()` (`ssgNodeRequire.js`). An expression or `export` in an authored page therefore runs with the docs-site build's Node privileges (filesystem, network, any CI secrets in the environment), then again in every reader's browser.
- **Imports reach the bundler.** Docusaurus documents webpack inline loaders in MDX imports, for example `import MyComponentSource from '!!raw-loader!./myComponent';` ([MDX and React, importing code snippets](https://docusaurus.io/docs/markdown-features/react#importing-code-snippets)). An unrestricted import can pull any file the build can read (path or package) into the published bundle.
- **Today's check cannot see these.** Converted pages are safe because `syntax.ts` escapes every `{` and `}` outside code (`s.replace(/\{(?!\/\*)/g, '\\{')...`), so MkDocs text never becomes an expression, and pages that fail MDX fall back to CommonMark (`format: md`), where MDX nodes do not exist. Authored MDX gets no such escaping. The probe ran these through `applyHtmlPolicy`; all compile as MDX and **none** is reported by it:

| Authored input | Regex policy | AST check (section 3) |
|---|---|---|
| `<a href={"javascript:alert(1)"}>` | passes | passed the probe's draft; rule 6 rejects it (see note) |
| `<a href={"java"+"script:…"}>` | passes | rejected: non-literal attribute expression |
| `<div {...{onClick: () => …}}>` | passes | rejected: spread attribute |
| `<div dangerouslySetInnerHTML={{__html: '<img src=x on'+'error=…>'}} />` | passes | rejected: attribute name and non-literal value |
| `Hello {globalThis.process?.env?.HOME}` | passes | rejected: expression |
| `export function f() { return require('child_process') }` | passes | rejected: ESM other than import |
| `import s from '!!raw-loader!/etc/hosts'` then `{s}` | passes | rejected: import source and expression |
| `import fs from 'node:fs'` | passes | rejected: import source |
| `<props.X />`, `<Foo />` | passes | rejected: component not on the list |
| `<script>{`alert(1)`}</script>` | rejected | rejected |

  Note: the probe's first-draft AST rules allowed a literal `href={"javascript:…"}` and `` href={`javascript:…`} ``. The final rule must run the existing `unsafeUrl` on every URL-bearing attribute value, whether a plain string or a literal expression.
- **Unverified hardening thought on the converter (not the ticket's scope):** the `{/*` exception in `syntax.ts` leaves a brace unescaped when a comment opens it. I tried `{/*x*/ alert(1)//\}`; the page failed MDX and fell back to CommonMark, so it did not execute. I did not prove the exception is unexploitable; it deserves a line in the planned security review of the allow-list.

## 2. What the syntax tree gives a check

With `remark-mdx`, everything MDX adds is a typed node, and the JavaScript inside is already parsed:

- `mdxjsEsm` (import/export blocks), with `data.estree` holding an ESTree `Program` ([mdast-util-mdxjs-esm](https://github.com/syntax-tree/mdast-util-mdxjs-esm)).
- `mdxFlowExpression` and `mdxTextExpression` (braces) ([mdast-util-mdx-expression](https://github.com/syntax-tree/mdast-util-mdx-expression)).
- `mdxJsxFlowElement` and `mdxJsxTextElement` with `name: string?` (absent for fragments) and `attributes: [MdxJsxExpressionAttribute | MdxJsxAttribute]`; an `MdxJsxAttribute` value is a string or an `MdxJsxAttributeValueExpression`; expression nodes carry `data.estree` ([mdast-util-mdx-jsx](https://github.com/syntax-tree/mdast-util-mdx-jsx)). The five node types are the ones `remark-mdx` names ([remark-mdx](https://mdxjs.com/packages/remark-mdx/)).
- `data.estree` is filled only "with `addResult`"; `micromark-extension-mdxjs` 3.0.0 (installed) passes `addResult: true`, so the trees are always there through `remark-mdx`.
- In `format: mdx` there is no `html` node: raw HTML parses as JSX (probe: `<div>x</div>` gives `mdxJsxTextElement`; `<!-- c -->` is a parse error). Docusaurus: "anything that looks like HTML is actually JSX" ([MDX and React](https://docusaurus.io/docs/markdown-features/react)). So the HTML allow-list has to be re-expressed over JSX nodes; a text regex is the wrong layer.

## 3. What a check can reliably reject and allow

Reliable means decided from the syntax tree alone, with no evaluation. Proposed rules (the probe implemented a draft of 1 to 5):

1. **ESM: imports only, from an allow-list; no exports.** Every statement in `mdxjsEsm.data.estree.body` must be an `ImportDeclaration`. `source.value` must match an exact list: `@theme/Tabs`, `@theme/TabItem`, `@site/src/components/{Applies,DeploymentValue,ApiReference}` (what `page.ts` emits today), plus partials: a relative path to a file whose basename starts with `_` and ends `.mdx` (the Docusaurus partial convention: the `_` prefix "will not create any doc page", [MDX and React, importing Markdown](https://docusaurus.io/docs/markdown-features/react#importing-markdown)). Reject `!` (loader syntax), `?` and `#` in sources, absolute paths, and any path resolving outside the content root or into a different version's tree. Exports are rejected outright (the docs only need them for inline components: "only paragraphs that start with `export` will be parsed as components"). If front matter needs data, it goes in YAML.
2. **Expressions: none, except comments.** A `mdxFlowExpression`/`mdxTextExpression` is allowed only when `data.estree.body` is empty (that is `{/* comment */}`). Partials that need `{props.x}` are a design choice: either forbid props (simplest) or allow exactly `MemberExpression(props, Identifier)` inside files whose name starts with `_`.
3. **Components: a closed list.** Any JSX name that starts with an upper-case letter or contains `.` (`<props.X>`, `<Foo.Bar>`) must be on the list: the imported names from rule 1 plus the imports' local bindings for partials. Docusaurus resolves capitalised names from imports, exports or the `MDXComponents` scope ([MDX and React, MDX component scope](https://docusaurus.io/docs/markdown-features/react#mdx-component-scope)). Note the classic theme's scope (3.10.2, `theme-classic/lib/theme/MDXComponents/index.js`) exposes `Head` and `Details` with no import. **`Head` should be rejected**: it writes into the document `<head>`. `Details` can stay.
4. **Lower-case elements: today's HTML allow-list, applied to JSX.** From MDX 3 "lower-case tag names are always rendered as native html elements" ([MDX and React](https://docusaurus.io/docs/markdown-features/react)), so rule by `name`: reject `script`, `style`, `form`, `object`, `embed`, `base`, `meta`, `link`, `frame`, `frameset`, `applet` (the current `FORBIDDEN_TAGS`); `iframe` only with a literal `src` on the allowed hosts. Better still, invert to an explicit allow-list of tags, which the AST makes cheap.
5. **Attributes: literal only, no handlers.** Reject `MdxJsxExpressionAttribute` (spread); names matching `/^on/i`, `dangerouslySetInnerHTML`, `ref`, `srcDoc`, `formAction`; any `MdxJsxAttributeValueExpression` whose estree is not a plain literal (string, number, boolean, `-n`, array or object of literals with non-computed keys, template with no `${}`). `literalValue` in `html-policy.ts` already implements this test for the quick-start meta and can be reused. `style={{…}}` objects stay allowed.
6. **URLs:** run `unsafeUrl` on `href`, `src`, `action`, `formAction`, `xlink:href`, `poster`, `data` whether the value is a string or a literal expression, and keep the Markdown link check (as mdast `link`/`image`/`definition` nodes rather than the `](` regex).
7. **Compile:** keep `compileCheck`, but see section 5: it must parse the way Docusaurus does.

What a check **cannot** reliably decide, and so must forbid rather than inspect: any non-literal expression or export (deciding what JavaScript does is undecidable in general; MDX's own advice for untrusted authors is sandboxing, not analysis), and what an allowed component does with its props (that is the component's responsibility: `Applies`, `DeploymentValue`, `ApiReference` should be reviewed to never pass a prop into `href`, `dangerouslySetInnerHTML` or a script; `ApiReference`'s `spec` prop selects a file to render and should resolve only inside the repo's spec folder).

Docusaurus's `format: md` (CommonMark, "does not allow the usage of JSX", experimental: [Markdown features, MDX vs. CommonMark](https://docusaurus.io/docs/markdown-features#mdx-vs-commonmark)) removes classes 1 to 3 for a page, but then raw HTML is `html` nodes passed through `rehype-raw`, and today's regex policy applies again. It is a useful fallback (the converter already uses it), not a way to author components or partials.

## 4. Mechanism options

| Option | How | Fit | Supply-chain and other notes |
|---|---|---|---|
| **A. remark plugin in `@wso2/docs-converter` (recommended)** | One `remarkMdxPolicy` (or similar) walking the tree as in section 3, exported like `rehype-valid-elements` is today; the `check` CLI runs it, and `docusaurus.config.js` adds it to the docs plugin's `beforeDefaultRemarkPlugins` so the build applies the same rules | Same code and parser in check and build; throwing from it fails the page; reuses `literalValue`, `unsafeUrl`, iframe hosts | No new dependencies: `remark-mdx`, `unified`, `acorn` already come with `@mdx-js/mdx` 3.1.1 and the converter. Converter is unpublished `0.1.0` (map: "Not yet specified"); the Action builds it from the docs-site repo with `npm ci --ignore-scripts`, which is the right default |
| B. ESLint with `eslint-plugin-mdx` + core rules | `eslint-mdx` parser; `no-restricted-syntax` (e.g. `ExportNamedDeclaration`), `no-restricted-imports`, a JSX element allow-list rule | Familiar to JS teams; editor squiggles | Separate parser from Docusaurus's (divergence risk). Pulls in ESLint plus the plugin's tree, maintained mainly by one person (license credits JounQin; MIT) ([mdx-js/eslint-mdx](https://github.com/mdx-js/eslint-mdx)). No built-in "only these components/imports" rule for MDX; you write selectors anyway |
| C. `remark-lint` | Configured rules plus a custom rule | Has MDX JSX style rules (attribute sort, self-close, quote style) and `remark-lint-no-html` ([remarkjs/remark-lint](https://github.com/remarkjs/remark-lint)) | No rules for imports, expressions or component allow-lists; `no-html` targets `html` nodes, which do not exist in MDX format. Useful for style, not for this boundary. MIT |
| D. Docusaurus `markdown.preprocessor` | String rewrite before parsing | Docs call it "a last-resort escape hatch" ([config: markdown](https://docusaurus.io/docs/api/docusaurus-config#markdown)) | Text-level, same weakness as today's regex |

Recommendation: **A**, as an allow-list over the MDX syntax tree, run in both the PR check and the docs-site build, failing the page. Keep B or C optional for writer ergonomics (style), outside the security boundary. Remark plugins are configured per content plugin through `remarkPlugins`/`beforeDefaultRemarkPlugins` ([Markdown plugins](https://docusaurus.io/docs/markdown-features/plugins)). Whether a thrown error in a remark plugin fails `docusaurus build` with the file named is not stated there; expected from unified's behaviour, but confirm with a test before relying on it.

## 5. Cost of keeping the check and the build on the same rules

- **Parser parity is the main cost.** `compileCheck` calls `@mdx-js/mdx` directly; Docusaurus first runs a preprocessor (`@docusaurus/mdx-loader/lib/preprocessor.js`: `unwrapMdxCodeBlocks`, `escapeMarkdownHeadingIds` under `mdx1Compat.headingIds`, admonition title rewriting) and its own remark plugins (`mdx1Compat` comments, admonitions, `details`, `head`, toc, links, images). Probe: `## T {#id}` and `<!-- c -->` are parse errors for plain `remark-mdx`, but valid in Docusaurus with default `mdx1Compat`. Either the check reproduces that pipeline (fragile: `@docusaurus/mdx-loader` exports only the loader and `createMDXLoaderRule/Item`, not a processor factory), or the authored-MDX contract forbids those MDX 1 compat forms (and the site sets `mdx1Compat` to `false` so they fail in both). The second is cheaper and is where Docusaurus is heading (`future.v4.mdx1CompatDisabledByDefault`, same config page).
- **Version drift.** The converter pins `@mdx-js/mdx` 3.1.1 exactly; `@docusaurus/mdx-loader` 3.10.2 asks for `^3.0.0` (and `^` ranges for `remark-gfm`, `remark-directive`, `rehype-raw`). Today the lockfile dedupes to one copy. Add a docs-site test that fails when the two resolve to different versions, or make the converter use a peer dependency.
- **Rule parity.** Running the same plugin in the build (option A) means the build cannot drift from the check, and an auto-merged bump can never bypass it. The fork's CI must pin the converter or Action by commit SHA (as the contract already says); allow-list changes then ship as a docs-site release that content repos adopt.
- **Allow-list ownership.** The component and import lists live with the converter (docs-site team), and the contributor guide in the fork lists the same names. Generate the guide's list from the code, or test that they match.
- **Converted vs authored pages.** Generated pages already pass these rules by construction (the converter emits only allowed imports and escapes braces), so applying the plugin to every page costs nothing for other products; it should be tested on the full docs-is tree before enabling.

## Open points for review

- Allow `props` in partials or not (rule 2).
- Explicit tag allow-list versus today's deny-list for lower-case JSX (rule 4).
- Whether `Head` is ever needed (for example per-page meta); if so, allow it only with literal `meta`/`title` children.
- Security review of the final rules, the components' prop handling, and the `{/*` converter exception before writers author MDX directly.
