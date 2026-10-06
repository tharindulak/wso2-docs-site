# Build-time conversion contract

Parent: [map](../map.md)
Type: grilling
Status: open
Assignee:
Blocked by: 07

## Question

Given that the docs site converts MkDocs content at build time ([Content format for content sources](06-content-format.md)), what is the contract with content sources: which MkDocs and Jinja subset they may use (conditions, variables, includes, raw HTML), whether the latent string-compare version bug is kept or fixed (7.10.0 sorting before 7.2.0), what the build does with a page that fails to convert or compile (fail the build, or skip and report), how content repos check conformance before merging (a lint in their CI), and who owns the converter?
