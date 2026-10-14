# How the lifecycle badge looks

Parent: [map](../map.md)
Type: prototype
Status: closed
Assignee:
Blocked by: 11, 12

## Question

How the badge looks on real Identity Platform pages: next to the page title, in the sidebar, and on a section; colour and wording per stage; how it sits with the Deployment options box; mobile. Prototype on the preview build, variants switchable, as `prototypes/prerequisites/`.

## Answer

Resolved 2026-10-14 by prototype (user decision). Prototype: `prototypes/lifecycle/` (`badge.ts`, `badge.css`, data from the fork's front matter via `data.ts`; run `node prototypes/lifecycle/serve.ts badge`), kept on branch `prototype/docs-is-components`.

- **Variant A: a pill beside the page title, and a small pill in the sidebar.** Chosen over a strip above the title and a row in the Deployment options box.
- The pill shows the stage, plus the deployment options when the stage covers only some of the page's ("Preview · WSO2 Cloud"); the one-line explanation shows on hover (`title`). The pill sits outside the heading text, so the anchor and TOC entry are unchanged.
- Colours: Beta violet `#7c3aed`, Preview teal `#0e7490`, Deprecated amber `#b45309`, white text.
- Where a pill shows "Deprecated", the "(deprecated)" suffix is removed from the page title, the sidebar label and the breadcrumb. The API spec's own title inside the API reference (e.g. "SCIM 2.0 Roles V1 API (deprecated)") comes from the spec file and stays.
- Beta and Preview were judged on sample markings (self-registration flow as Preview on WSO2 Cloud; Login Flow AI and Branding AI as Beta); no page carries those stages yet.
