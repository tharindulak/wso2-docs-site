# What the check enforces

Parent: [map](../map.md)
Type: grilling
Status: closed
Assignee: tharinduj
Blocked by: 02, 04

## Question

Which hand-written patterns fail (Step runs outside `<Steps>`, a Prerequisites heading or Before-you-begin admonition outside `<Prerequisites>`, a closing link list outside `<LinkCards>`, deprecation warnings without the deprecated form, …); error versus warning; new pages versus edits versus untouched pages; an escape hatch for legitimate exceptions; where and how it runs (the fork's CI, locally, in the editor); the tool from the research.

Input (2026-10-14) from [What tools can check MDX for missing components](02-mdx-lint-tools.md): tool = a contract pass in `wso2-docs check`; open points it leaves here: `mdx.format: md` pages, the escape hatch, and the full allowed-components list (`ApiReference`, `Recommendation`, `Redirect`, `DbConfigTable`, … already used in the tree).

Input (2026-10-14) from [Should authored pages be .mdx or .md?](03-md-or-mdx.md): the check rejects `mdx.format: md` (no CommonMark pages), and a `.md` authored page.

Input (2026-10-14) from [What a writer sees](04-writer-experience.md): report only the outer finding when a Before-you-begin note sits inside a Prerequisites section (following both fixes would nest panels); decide whether a link-card item with no writer text is a warning or nothing; every finding was an error in the prototype (error versus warning and the escape hatch are still open). The prototype's `check.ts` is a working starting point (rules, messages, fix hints).

## Answer

Resolved 2026-10-14 by grilling (user decisions). Tool: a contract pass in `wso2-docs check` ([What tools can check MDX for missing components](02-mdx-lint-tools.md)); rules start from the prototype's `check.ts` ([What a writer sees](04-writer-experience.md)).

- **Errors (block a pull request):** a run of "Step N" headings outside `<Steps>`; a Prerequisites heading or Before-you-begin note outside `<Prerequisites>` (only the outer one when nested); `:::warning[Deprecated …]` instead of `:::deprecated`; an unknown component; `mdx.format: md`; a `.md` authored page; `<Steps>` nested deeper than one level; a "Step N:" prefix left in a heading inside `<Steps>`.
- **Warning:** a closing link list ("What's next", …) outside `<LinkCards>` (a writer may want a plain list, e.g. of external links).
- **Nothing:** a link card with no description text (the guide encourages descriptions).
- **Scope:** every authored page in every version, on every pull request (the rewritten tree starts with 0 errors); annotations on changed lines.
- **Escape hatch:** a comment on the line before, with a reason: `{/* wso2-docs-check-ignore <rule>: <reason> */}`; it silences that one finding; CI counts ignores in its summary; an ignore without a reason is an error. Front-matter switches (`stepper: false` …) no longer apply to migrated content; they remain only for MkDocs products still converted.
- **Where:** the fork's CI on every pull request, blocking on errors, beside the migration map's authored-MDX check; and a local command for writers (`npm run check`). Editor integration waits until writers ask.
- **Before cutover:** the same check runs on the generated tree in the docs-site CI once the rewrite lands, so a converter change cannot reintroduce hand-written patterns.
- **Priority (user, 2026-10-14):** the check is not a priority at the moment; [Build the check](08-build-check.md) is on hold.

