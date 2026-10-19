# Build the check

Parent: [map](../map.md)
Type: task
Status: open
Assignee:
Blocked by: 05, 06

## Question

AFK, test-first: implement the rules from [What the check enforces](05-check-rules.md) in the chosen tool (`wso2-docs check` or other), wire it into the fork's CI with the migration map's authored-MDX check, run it over the rewritten tree (expect no errors), and document the messages.

Input (2026-10-14): parse the raw source with front matter blanked so line numbers are right; the research found `compileCheck`'s compile-error lines likely offset by the front matter (read, not run): verify and fix while here.

On hold (user decision 2026-10-14): not a priority at the moment. The rules are decided in [What the check enforces](05-check-rules.md); pick this up when the user asks.
