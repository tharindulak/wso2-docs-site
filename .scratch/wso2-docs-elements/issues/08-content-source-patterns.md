# Patterns writers already hand-build in our content sources

Parent: [map](../map.md)
Type: research
Status: closed
Assignee: tharinduj
Blocked by:

## Question

Across the content sources at Latest (snapshots under `docs-site/.cache/sources/`), which structures do writers repeat by hand that a content component or automatic rendering could serve: `## Step N` procedures, prerequisites / "Before you begin" sections, version or feature-history notes, Beta/Preview/Deprecated mentions, required roles or permissions, "Next steps" / "Related topics" closings, Console vs CLI vs API tab groups, MkDocs extensions and custom CSS classes in use? For each: how many pages and sources, the variants of wording and markup, and whether the converter could detect it reliably without author changes.

Research: [08 Content source patterns](../research/08-content-source-patterns.md)

## Answer

Resolved 2026-10-12 by [08 Content source patterns](../research/08-content-source-patterns.md) (Latest of each section, 7,214 files, regex counts). Gist:

- Prerequisites sections: 1,288 pages in 22 of 23 buckets; 865 use exactly `## Prerequisites`. Detectable.
- `Step N` headings: 1,035 pages in 13 repos; 81% `Step N:`, APIM and APK `Step N -`; 121 restart numbering, 55 use sub-steps. Headings detectable; where a procedure starts and ends is not.
- Closing sections: 844 pages, 11 wordings ("What's next", "Next steps", "Related topics", "See also"...). Detectable.
- Tabs: 678 pages, 424 distinct labels; Console/CLI/API groups barely exist (6); OS tabs have 28 spellings. Synced tabs need a label normalisation map; linked tabs already on in 7 of 14 MkDocs configs.
- Rare: version notes (26 pages, mostly IS "update level"), Beta/Experimental/Deprecated labels (45 pages). Required roles are free prose, not detectable.
- `quick_start` comes from a `<script> const meta` block on 35 IS pages, not front matter.
