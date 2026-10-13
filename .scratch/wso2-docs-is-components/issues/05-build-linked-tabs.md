# Build linked tabs

Parent: [map](../map.md)
Type: task
Status: closed
Assignee: tharinduj
Blocked by: 01

## Question

Build linked tabs as decided in [Which tab label sets sync, and how](01-linked-tabs.md): a site-build remark plugin with tests (tdd), wired in `docusaurus.config.js`, rebuilt into the Identity Platform preview and checked on real pages. Record the commit and the pages affected.

Spec: the answer on [Which tab label sets sync, and how](01-linked-tabs.md). Tests must cover: identical sets in different order link; OS aliases link; a block with a `groupId` or non-positional values is left alone; single-tab blocks and normalisation collisions are skipped; tabs inside `<Applies>` and partials. Also fix the "nnpm" label in the MkDocs source on the fork (`/Users/admin/Documents/wso2/git/docs`, branch `docusaurus-migration`) and regenerate.

## Answer

Built 2026-10-14 (AFK, test-first): commit `eaf4cd5` on `docs-is-migrate`, `remark-linked-tabs` (exported `@wso2/docs-converter/remark-linked-tabs`), wired after `remark-steps`.

- Value = label slug (lower case, non-alphanumeric runs to `-`); OS aliases `macos-linux`, `linux-macos`, `linux-unix` map to `linux`; `groupId` = sorted values joined by `_`, length-capped with a sha256 suffix.
- Left alone: Tabs with `groupId`, `defaultValue`, `values`, `queryString` or a spread; any non-`tab-N` value; non-TabItem children; non-string or empty labels; fewer than 2 tabs; colliding values. Subsets do not link (Windows/Linux/macOS and Windows/Linux are different groups).
- Tests: converter 176/176; scripts and site 96/96 with `DOCS_SITE_TEST_OWNER=tharindulak`.
- Real content (6,568 generated Identity pages): 916 of 1,082 blocks linked on 382 pages, 91 groups (largest npm/pnpm/yarn 113, linux/windows 70); 166 single-tab blocks skipped; no compile failures caused.
- Preview rebuilt into `site/build-preview`; warning set identical to the previous build.
- Not done: the "nnpm" fix (see map, Not yet specified). Found in the fork's `en/includes/quick-starts/mcp-auth-server.md` (labels at lines 27, 63, 84, 225, 303; commands at 30, 66, 67, 87, 227; also a yarn tab running `npm start` at 300) and `cloudflare-mcp-server.md` (labels 43, 163; command 46).
- Found: three tab blocks compile as raw HTML (`tabitem` lowercase; labels such as "Cursor", "AWS ECS"/"Fargate", "Gradle"), so they render as no tabs at all; predates this work.
- "nnpm" fixed 2026-10-14 (user decision): fork commits `f30abe90` (source) and `ce627dde` (regenerated tree, three pages changed), lock bumped in `7730127`; the MCP quick-start tabs now join `npm_pnpm_yarn`. Left as is: the start block's yarn and pnpm tabs both run `npm start`; `pnpm init -y` may be rejected by some pnpm versions (unverified).
