# Which tab label sets sync, and how

Parent: [map](../map.md)
Type: grilling
Status: closed
Assignee: tharinduj
Blocked by: 

## Question

Identity Platform has 427 `<Tabs>` on 174 pages, all with positional values (`tab-0`, `tab-1`), so tabs with the same labels never switch together; MkDocs sources that enabled Material's `content.tabs.link` had that behaviour. Which label sets sync (npm/yarn/pnpm, Visual Editor/Classic Editor, JKS/PKCS12, Windows/Linux/macOS, others), how labels are normalised into one value per choice (spelling variants), whether sync is per page or site-wide, whether the reader's choice persists (Docusaurus `groupId` stores it in localStorage), and what happens to a tab set that holds only some of a group's labels. Built as a site-build remark plugin (map Notes), so it must not depend on converter output.

Taken over from [Spec: keep linked tabs working](../../wso2-docs-elements/issues/10-linked-tabs.md).

## Answer

Resolved 2026-10-13 by grilling (user decisions). Facts behind it: docs-is enables Material's `content.tabs.link` (`en/base.yml`), so Identity readers have label-linked tabs today; Latest has 427 tab blocks, 137 distinct label sets, all with positional values and no `groupId`; Docusaurus 3.10 tabs sharing a `groupId` share one stored value (`localStorage` key `docusaurus.tab.<groupId>`), and a block without that value keeps its default.

- **Grouping: automatic, from the label set.** Each qualifying block gets a `groupId` derived from its normalised, sorted labels, and each tab's value becomes its normalised label. Blocks offering the same choices switch together; each set remembers its own choice. No curated list. Sets such as Request format / Sample request link too (as on MkDocs today).
- **Persistence:** the choice is kept in `localStorage` (Docusaurus default) across pages, versions and visits. Not in the URL (`queryString` off) for now.
- **Normalisation:** ignore case, surrounding spaces, Markdown formatting (`**Format**`) and label order; plus an alias list that starts with the OS forms only ("macOS/Linux", "Linux/macOS", "Linux/Unix", "Linux" are one choice). Add an alias only when a real pair of sets should link but does not.
- **Typos are fixed at the source**, not aliased: "nnpm" (7 blocks, 2 pages) is corrected in the MkDocs source on the fork.
- **Untouched blocks:** any block that already has a `groupId` or a non-positional value (Docusaurus-kind sources such as Integrator and Agent Manager, which may also set `defaultValue`); blocks with a single tab (22 in Latest); blocks where two labels normalise to the same value.
- **No writer opt-out** for now (sync does not change layout; Identity behaves this way on MkDocs). Add `linked_tabs: false` only if a page needs it.
- **Seam:** a site-build remark plugin over `<Tabs>` JSX blocks, as the map's standing decision, so it does not depend on converter output.
- Glossary: **Linked tabs** added to CONTEXT.md (avoid "synced tabs", "tab groups").

