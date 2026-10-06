# Deployment-option label

Parent: [map](../map.md)
Type: prototype
Status: resolved
Assignee: tharinduj
Blocked by: 04

## Question

How is a page's deployment option (WSO2 Cloud, Hybrid, Self-hosted) declared (page front matter, section default, or both), how does it render (GitLab-style details block under the title, sidebar badges, or both), and what happens when a section differs per deployment option? Prototype the rendering in the Oxygen UI theme.

## Answer

Decided with the user, 2026-10-06, after comparing three variants on real converted Identity Platform pages in the Oxygen look (prototype on branch `prototype/deployment-option-label`, `prototypes/content-format/`, `?variant=A|B|C`).

- **Variant A, GitLab style, throughout:**
  - Page level: an outlined box under the title, "Deployment options: WSO2 Cloud, Self-hosted" (MUI island, Oxygen theme).
  - Content for one option only (`<Applies>`): a tinted callout with a left border in the option's colour and an uppercase "WSO2 CLOUD ONLY" / "SELF-HOSTED ONLY" heading.
  - Values that differ (`<DeploymentValue>`): both shown inline with labels, `value (WSO2 Cloud) / value (Self-hosted)`; inside code samples, a named placeholder.
  - Not chosen: chips and sidebar badges (B), margin markers with tooltips (C; tooltips hide values readers copy).
- **Declaration:** per page in front matter (`deployment_options`), set by the converter for merged pages and by hand on hub pages; a section default (folder `_category_` metadata) applies to pages that don't set it; page wins.
- Older self-hosted versions show "Deployment options: Self-hosted" (see [Versioning details](08-versioning-details.md)).
- Option colours in the prototype: WSO2 Cloud #2e7dd7, Hybrid #7b4fd6, Self-hosted #b25000; check contrast in both themes when building the skeleton.
