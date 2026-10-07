# Custom MkDocs page templates

Parent: [map](../map.md)
Type: prototype
Status: open
Assignee:
Blocked by:

## Question

616 pages across the content sources select a custom MkDocs theme template in front matter (`template: templates/<name>.html`): redoc 245 (see [Render API references](17-api-reference-rendering.md)), complete-guide 212, sdk 84, quick-start 36, connector 13, and 13 rarer layouts (home pages, no-sidebar and single-column variants). MkDocs renders extra UI from them, such as the quick-start "What you will learn" and prerequisites boxes (from the page's `const meta = {...}`) and numbered steps between `[//] STEPS_START/END`. The converter now keeps the template name (`mkdocs_template`) and quick-start data (`quick_start`) as front matter but renders no template UI. Which templates need a Docusaurus equivalent (a page layout keyed on `mkdocs_template`), which can be dropped, and what does each look like in the Oxygen design? Prototype quick-start and complete-guide first. Found 2026-10-07 from the React quick-start page.
