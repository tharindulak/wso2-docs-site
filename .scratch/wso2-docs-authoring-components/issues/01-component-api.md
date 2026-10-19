# How writers write each component

Parent: [map](../map.md)
Type: grilling
Status: closed
Assignee: tharinduj
Blocked by: 

## Question

What is the explicit, writer-friendly form of each component, writable without hand-built data: `<Steps>` (steps and sub-steps; numbering; headings inside or a `<Step title>` child), `<Prerequisites>` (title; the admonition form), `<LinkCards>` (wrapping an ordinary Markdown list; descriptions), deprecated sections (a `<Deprecated>` block or the `:::deprecated` admonition), and how tabs (linked automatically or a writer-set group) and lifecycle front matter fit. Names, props, nesting rules, and what each renders to; consistency with existing `<Applies>`, `<Tabs>`, `<DeploymentValue>`. Must keep anchors, the TOC, search records and Markdown output ("Copy as Markdown", llms.txt) working.

## Answer

Resolved 2026-10-14 by grilling (user decisions). Facts: existing components wrap ordinary Markdown with blank lines (`<Applies to="…">`, `<Tabs>`/`<TabItem>`); Docusaurus lists headings inside components in the TOC; 44 links point at `#step-…` anchors and 61 at `#prerequisites` / `#before-you-begin` (all versions).

- **`<Steps>` wraps headings; numbers are automatic.** Writers drop "Step N:" from headings; each heading inside is a step, numbered in order; headings stay real headings (TOC, anchors).
  ```mdx
  <Steps>

  ## Configure Azure
  …
  ## Configure WSO2 Identity Server
  …
  </Steps>
  ```
- **Sub-steps are a nested `<Steps>` inside a step**, numbered from the parent (1.1, 1.2), shown with the filled badge; text after the inner `</Steps>` belongs to the parent step. One level only; deeper nesting is flagged by the check.
- **`start` attribute** for procedures that do not start at 1 (`<Steps start={0}>`); skipped numbers in today's content are typos and are renumbered by the rewrite.
- **Old anchors kept:** the one-off rewrite gives each rewritten step heading an explicit id equal to its old anchor (e.g. `step-1-configure-microsoft-azure`); new headings get normal ids. The MDX explicit-id syntax is verified in the build.
- **`<Prerequisites>` has two forms:** wrapping the writer's own heading and its content (in the TOC, keeps `#prerequisites`), or `<Prerequisites title="Before you begin">` with no heading (not in the TOC; used where today's page has a `:::note[Before you begin]` admonition). The rewrite keeps each page's current TOC.
- **`<LinkCards>` wraps an ordinary Markdown list**; the heading ("What's next?") stays outside. Card description: the writer's text after the link, else the linked page's description.
- **Deprecated sections use the `:::deprecated[Title]` admonition** (already built); page-level deprecation stays in front matter (`status: deprecated`, `deprecated_since`, `replacement`).
- **Tabs unchanged:** `<Tabs>`/`<TabItem>` as Docusaurus defines them; linked automatically by label; a writer may set `groupId` to override.
- Glossary: **Steps**, **Sub-step**, **Prerequisites**, **Link cards** added to CONTEXT.md.

