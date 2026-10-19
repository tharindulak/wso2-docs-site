# How closing sections look

Parent: [map](../map.md)
Type: prototype
Status: closed
Assignee: tharinduj
Blocked by: 

## Question

What do closing sections look like on real Identity Platform pages: link cards (title plus description of each linked page) or a styled list? Covers which headings count ("What's next?", "What's next", "Next steps", "Learn more", "See also", and their `###` forms), what a section holding prose rather than a link list becomes, external links, and a writer opt-out. Prototype on the preview build with sample descriptions; whether real descriptions are available is [Can the site build read a linked page's title and description?](04-linked-page-metadata.md).

Input (2026-10-13): [Can the site build read a linked page's title and description?](04-linked-page-metadata.md) found that cards would mostly show Docusaurus's first-line excerpts (2 of 125 linked targets have a front-matter description), so the prototype should use real excerpts, not sample descriptions, and check trailing-slash matching, CommonMark fallback pages, and closing sections inside `<Applies>` and partials.

## Answer

Resolved 2026-10-14 by prototype (user decisions). Prototype: `prototypes/closing-sections/` (variants 0 to D on the real Identity preview), kept on branch `prototype/docs-is-components`.

- **Look: cards** (variant A): a responsive grid; each card shows the link text as title (primary colour, → for internal, ↗ for external) and a description clamped to three lines. Chosen over rows, an "Up next" lead card, and a plain framed box.
- **Which sections:** `h2`/`h3` titled "What's next" (with or without "?" and any capitalisation), "Next steps", "See also", "Learn more", "Related topics", "Related links", "Further reading"; the section runs to the next heading at its level or above. The heading stays (anchor, TOC).
- **Only link lists become cards:** a section that is a single list whose items each start with a link and hold no nested list. Anything else (prose, several blocks, nested lists) stays as written, unframed. About half the Identity sections are prose today (28 of 55 by the prototype's scan).
- **Card description:** the author's own text after the link in the item ("Link — does X", leading dash or colon dropped) first; else the linked doc's description from Docusaurus doc metadata (front matter, or its first line; same as `<meta name="description">`), per [Can the site build read a linked page's title and description?](04-linked-page-metadata.md); external links show their host; otherwise no description.
- **Card title:** the author's link text, not the target's title.
- **Opt-out:** `link_cards: false` in front matter.
- Facts from the prototype: login-flow-builder's four cards all fall back to page descriptions and some exceed 160 characters (clamped); oid4vci's "See also" carries author descriptions on every item.

