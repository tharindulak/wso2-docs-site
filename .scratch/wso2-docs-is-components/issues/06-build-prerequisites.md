# Build the prerequisites block

Parent: [map](../map.md)
Type: task
Status: closed
Assignee: tharinduj
Blocked by: 02

## Question

Build the prerequisites block as decided in [How the prerequisites block looks](02-prerequisites-look.md): site-build remark plugin plus styles, tests (tdd), wired in `docusaurus.config.js`, rebuilt into the Identity Platform preview and checked on real pages. Record the commit and the pages affected.

Spec: the answer on [How the prerequisites block looks](02-prerequisites-look.md). Styles: `prototypes/prerequisites/prereq.css`, variant A, without the checkbox rules. Tests must cover: both forms and every admonition type, `h2` and `h3`, a block ending at the next heading and at a stepper, two blocks on one page, a block inside `<Applies>`, the opt-out, and that the heading id is unchanged. Run after `remark-steps` so a stepper boundary is visible, or detect Step headings directly; check the plugin order in a test.

## Answer

Built 2026-10-14 (AFK, test-first): commit `d4afa63` on `docs-is-migrate`, `remark-prerequisites` (exported `@wso2/docs-converter/remark-prerequisites`), wired after `remark-steps` and `remark-linked-tabs` (a site test fails if it moves before `remark-steps`).

- Output: `div.prerequisites > div.prerequisites__head + div.prerequisites__body`; heading form keeps its h2/h3 (id and TOC unchanged); admonition form gets `p.prerequisites__title` with the author's title. Styles in `site.css` from prototype variant A with ordinary bullets.
- Rules as specified, plus: titles must match exactly after trimming ("Before you begin!", "Before you begin: Enable tenant URL mode", "General prerequisites" stay as written); a block ends at a stepper whatever its Step heading level; blocks are not nested; an empty block stays a plain heading; `h4` "Prerequisites" (15 across versions) not wrapped.
- Tests: converter 189/189 (13 new, compiling real MDX with Docusaurus's admonitions, headings and TOC plugins); scripts and site 97/97.
- Real content: Identity Latest 199 panels on 168 of 1,065 pages (127 heading, 72 admonition; 27 followed by a stepper; 25 pages with two or more); all versions 1,176 panels on 1,072 pages. No failures caused.
- Preview rebuilt; warnings identical to the previous build.
- 168 vs the prototype's 178: the prototype's scan matched admonition titles by substring (it counted "Before you begin!" and similar); the plugin matches exactly.
- Concern: converter tests import `@docusaurus/mdx-loader/lib/remark/...` without declaring it; it resolves only through the shared workspace `node_modules`.

- Follow-up 2026-10-14 (user decisions): `2559a90` accepts a trailing "!" ("Before you begin!", 88 admonitions across versions, 5 in Latest) and declares `@docusaurus/mdx-loader` 3.10.2 as a converter dev dependency (lockfile only). Tests 190/190 and 97/97. Preview not rebuilt for this; the next build picks it up.
