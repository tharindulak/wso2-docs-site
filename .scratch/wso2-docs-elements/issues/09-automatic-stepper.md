# Spec: automatic stepper from Step headings

Parent: [map](../map.md)
Type: grilling
Status: closed
Assignee:
Blocked by: 02

## Question

How does the docs site render runs of `Step N` headings as a stepper without author changes? Covers: which heading forms count (`Step 1:`, `Step 1 -`, `Step 1.`), skipped or restarted numbering, nested sub-steps, ordered lists inside a step, mobile layout, anchors and the table of contents, and how a writer opts a page out.

Starting proposal (2026-10-13, from the prototype discussion, not yet decided): keep `## Step N:` in the source; the converter wraps the prefix in a visually hidden span so the circle shows the number while anchors, screen readers, search, Markdown output and MkDocs preview keep "Step N:". Open: whether the table of contents shows the prefix. Prototype: `prototypes/docs-components/` (shot `2-stepper-tabs-code.png`).

Fact for this spec (2026-10-13): three sections are `kind: docusaurus` (Integrator, Agent Manager and one more in `content-sources.yaml`); their pages go through `prepareDocusaurusDocs` (source.ts), not the MkDocs rewrite in `syntax.ts`. Integrator alone has 409 Step-heading pages. Converter detection would need both code paths, so the starting proposal is a remark plugin in the site build (beside `rehypeValidElements` in `docusaurus.config.js`) plus a `Steps` component in `site/src/components/`. The same reasoning applies to the prerequisites and next-steps blocks.

## Answer

Resolved 2026-10-13 by prototype and build (user decisions):

- Look: style A, numbered circles joined by a line, chosen over cards and a progress strip in `prototypes/stepper/` (served real built pages across IS, APIM, Integrator, Agent Manager).
- Seam: `remark-steps`, a remark plugin in the site build (exported by `@wso2/docs-converter`), so MkDocs and Docusaurus-kind sources both get it. It runs after Docusaurus sets heading ids and the TOC: anchors unchanged, the TOC keeps "Step N:".
- Rules: two or more Step headings at one level form a run; a step holds everything up to the next heading at its level or above; the circle shows the author's number (Step 0 and skips kept); a number not above the previous starts a new run; `Step N.M` sub-steps and lone Step headings stay as written; separators `:`, `-`, `–`, `.`, none; runs inside JSX blocks are wrapped. The prefix moves into a visually hidden span.
- Opt-out: `stepper: false` in front matter.
- Built: commit `7f9e4e2` on `docs-is-migrate`; 239 of 6,568 Identity pages get a stepper. Further component work on Identity Platform continues in [Content components on Identity Platform](../../wso2-docs-is-components/map.md).
