# How the prerequisites block looks

Parent: [map](../map.md)
Type: prototype
Status: closed
Assignee: tharinduj
Blocked by: 

## Question

What does the prerequisites block look like on real Identity Platform pages, and which source forms become it? Two forms today: a `## Prerequisites` / `## Before you begin` heading (112 pages) and a `:::note[Before you begin]` admonition (63 pages). Covers: one look for both forms or two, whether the heading stays in the table of contents, how it sits next to the deployment options box and the stepper, what a block with sub-headings or tabs inside does, and a writer opt-out. Prototype on the preview build (as `prototypes/stepper/`), variants switchable.

## Answer

Resolved 2026-10-14 by prototype (user decisions). Prototype: `prototypes/prerequisites/` (variants 0 to D on the real Identity preview), kept on branch `prototype/docs-is-components` (commit c449b56).

- **Look: Panel with ordinary bullets** (variant A without the checkboxes): a box where the block is written, primary-colour left border and light tint, a ✓ circle before the title. Chosen over a collapsible line, a ✓ item on the stepper rail, and a header box above the page title.
- **Title:** the author's own text ("Prerequisites" or "Before you begin"), so the anchor and TOC entry do not change.
- **Both source forms become the same panel:** the heading form, and admonitions titled "Prerequisites" or "Before you begin" of any type (note, tip, info, warning; the type is dropped).
- **Several blocks on a page:** each is its own panel where it is written; nothing merges or moves.
- **Content:** heading form, everything up to the next heading at its level or above, or the start of a stepper (sub-headings, admonitions, tabs and code stay inside); admonition form, the admonition's content.
- **Which headings:** `h2` and `h3` titled exactly "Prerequisites" or "Before you begin", case-insensitive; no other wordings until a page needs one.
- **Opt-out:** `prerequisites: false` in front matter (changes layout, unlike linked tabs).
- Facts from the prototype (Identity Latest preview): 178 pages have a block; 37 place it after other sections; one page (Sift fraud detection) has two; the longest (Identity Server install) has 17 items with sub-headings and admonitions inside; one (React Native) holds tabs.

