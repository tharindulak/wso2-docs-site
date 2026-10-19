# How deprecation notices and the Deprecations page look

Parent: [map](../map.md)
Type: prototype
Status: closed
Assignee:
Blocked by: 12

## Question

How a deprecation notice looks on a deprecated page or section (date, removal, replacement), and how the central Deprecations page lists entries (table or list, grouping by removal date or area, links). Prototype on the preview build with the seed pages.

Open input (2026-10-14): MkDocs admonitions take no options, so a section-level deprecation cannot carry `deprecated_since` / `replacement` in MkDocs syntax. Decide how a section records them (for example a first line inside the admonition, or front matter keyed by heading) as part of this prototype. The 3 seeded sections use `!!! deprecated "Title"` with no fields.

## Answer

Resolved 2026-10-14 by prototype (user decisions). Prototype: `prototypes/lifecycle/` (`deprecation.ts`, `deprecation.css`; run `node prototypes/lifecycle/serve.ts deprecation`), kept on branch `prototype/docs-is-components`.

- **Deprecated page: variant A, a notice box under the title**: "Deprecated" tag and since (per deployment option when they differ: "on WSO2 Cloud since 2026-03; in Identity Server since 7.3.0"), the one-line explanation, a "Use <replacement> instead →" button per distinct replacement, and a "How deprecation works" link to the self-hosted Feature Deprecation page. No removal line while no date is approved.
- **Deprecations page: variant A, a table** (Deprecated, Deployment option, Since, Use instead, Removal "Not announced") with version tabs (Latest, 7.2.0, 7.1.0, 7.0.0), one page per version built from that version's marked pages and sections. A newest-first timeline was rejected: WSO2 Cloud dates by month and Identity Server by version, so it cannot be ordered truthfully.
- **Deprecated sections:** the amber treatment always; the "Deprecated" tag only when the writer's title does not already say deprecated (all three seeded titles do). A scope line ("Applies to Identity Server") shows; no date line while none is recorded.
- **Not decided here:** how a section records `deprecated_since` / `replacement` in MkDocs syntax (admonitions take no options); moved to Not yet specified.
