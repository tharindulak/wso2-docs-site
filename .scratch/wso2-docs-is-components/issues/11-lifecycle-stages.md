# Which lifecycle stages, and what each means

Parent: [map](../map.md)
Type: grilling
Status: closed
Assignee: tharinduj
Blocked by: 

## Question

Which stages does the badge show (Beta, Preview, GA, Deprecated; Removed or Experimental?), and what does each mean for a reader, matched to WSO2's Operational policies? Is GA shown at all, or only the absence of a badge? Preview is a Console setting (cloud): how do stages relate to deployment options (a feature in Preview on WSO2 Cloud but GA in Identity Server)? Names, wording and colours follow from this.
Facts (2026-10-14, Identity Latest): Operational policies (`references/operational-policies.md`) define Beta features (10.3) and a deprecation window; 3 API pages say "(Deprecated)" in their title (end-user credential management, organization user share, roles v1); 3 sections use `:::warning[Deprecated …]`; "Feature Preview" is a Console toggle described in steps (e.g. self-registration flow); no page is marked Beta or Preview; front matter has no status field.

## Answer

Resolved 2026-10-14 by grilling (user decisions). Sources: Operational policies 10.2 New Features ("New" tag), 10.3 Beta Features, general availability (cloud); the Console's Feature Preview dialog; self-hosted "WSO2 Identity Server Feature Deprecation" (phases Planned, Deprecated, Retired; self-hosted only, lists no features).

- **Stages with a badge: Beta, Preview, Deprecated.** Generally available has no badge (the absence of one). "New" is not a badge (parked, needs an expiry rule).
- **Beta and Preview are distinct.** Beta: available to everyone, may change before general availability. Preview: off by default, an admin switches it on in the Console's Feature Preview. If both apply, Preview wins (it tells the reader what to do).
- **Scoped by deployment option:** a stage applies to all of a page's deployment options unless scoped to one ("Preview on WSO2 Cloud"); the badge shows the scope.
- **Self-hosted phases:** only Deprecated is marked. Planned and Retired get no badge and no special handling.
- **Versions:** every version is marked (as the other components apply to all versions), not only Latest.
- **Badge wording** (shown with the badge, e.g. on hover or in a notice):
  - Beta: "Available to everyone; may change before general availability." Link: Operational policies, 10.3 Beta Features.
  - Preview: "Turn it on in the Console under Feature Preview before use." No link yet.
  - Deprecated: "Still works, but not recommended; it will be removed in a future release." Link: the self-hosted Feature Deprecation page; none for WSO2 Cloud yet.
- **Leaving a stage:** when a feature becomes generally available the writer removes the status and the badge disappears; no "available since" note (release notes carry history).
- **Deprecations page:** one per version, built from that version's pages marked Deprecated.
- Glossary: **Lifecycle stage** added to CONTEXT.md (avoid "release stage", "launch stage", "status").

