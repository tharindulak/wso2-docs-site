# Make the excluded Identity pages convert

Parent: [map](../map.md)
Type: task (AFK)
Status: open
Assignee:
Blocked by: 04

## Question

14 pages across 5 IS versions fail today (7 distinct causes, listed in [Clone the fork and record a conversion baseline](04-clone-and-baseline.md)), plus one that now passes and only needs leaving the list, and nothing can stay behind on MkDocs in a migration. Fix the converter first (test first, behind the conversion contract), then the MkDocs source in the fork for anything left over. Done when every IS version in the lock file converts and compiles with an empty exclude list. Resolution lists each page with its fix and where it was made.
