# Render API references

Parent: [map](../map.md)
Type: research
Status: open
Assignee:
Blocked by:

## Question

Identity Platform has 178 API reference pages that embed an OpenAPI viewer (`<redoc spec-url="…yaml">`, loaded by an MkDocs template); in the docs site they currently render as escaped text. Which Docusaurus approach renders OpenAPI specs from content sources (for example a Redoc component, `docusaurus-plugin-openapi-docs`, or Scalar), how does each handle specs pinned in the content source, versions, search indexing, theming in the Oxygen look and bundle size, and what do the other products (API Platform, Integration Platform) use for their API references? Found in the first full build (2026-10-07).
