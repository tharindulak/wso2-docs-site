# Should authored pages be .mdx or .md?

Parent: [map](../map.md)
Type: grilling
Status: closed
Assignee: tharinduj
Blocked by: 

## Question

The docs-is tree is 6,528 `.md` files compiled as MDX only because the site sets `markdown.format: 'mdx'`. Rename authored pages to `.mdx` during the one-off rewrite (links updated, URLs unchanged; ~6,500 mechanical renames in the migration PR), or keep `.md` and configure tools to treat it as MDX? Also: the 95 pages declaring `mdx.format: md` (CommonMark) cannot host components; fix their MDX-breaking text, and how. Effects on editors, GitHub preview, formatters, the check, and a future Docusaurus `detect` setting.

## Answer

Resolved 2026-10-14 by grilling (user decisions). Facts: of the 95 pages declaring `mdx.format: md`, 16 already compile as MDX; 79 fail on unclosed raw HTML (`<br>`, `<img>`), tag-like text (`<user@example.com>`, placeholders such as `<8 …>`) and stray `{…}` braces, patterns the converter already fixes on most pages.

- **Authored pages are `.mdx`**, every page; partials are `.mdx` already. URLs do not change; links between pages are rewritten to the new names in the same step.
- **All versions** (Latest and 7.2.0 down to 5.9.0) are renamed and rewritten to explicit components in the one-off rewrite, since the site renders only explicit components.
- **No CommonMark pages:** drop `mdx.format: md` from the 16 that compile; extend the converter's fixes for the 79 (close or escape stray HTML, escape `<…@…>` and placeholders, escape braces); hand-fix any left in the MkDocs source. The check rejects `mdx.format: md` on new pages.

