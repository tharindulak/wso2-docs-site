# Measure conversion of every product's docs

Parent: [map](../map.md)
Type: task (AFK)
Status: resolved
Assignee: tharinduj
Blocked by:

## Question

For every content source behind wso2.com/documentation (see [Product catalogue](../assets/product-catalogue.md)), how much converts and compiles cleanly as Docusaurus MDX with the prototype converter, and what blocks the rest? Output per product: pages, tooling (MkDocs or Docusaurus), conversion and compile rates, top failure causes, unsupported constructs. Feeds the user's decision on which products move into the docs site for WSO2Con instead of linking out (user chose "measure first", 2026-10-07).

## Answer

Resolved 2026-10-07. Full table: [Conversion survey](../research/16-conversion-survey.md).

- 16 content sources, 6,617 Latest pages: 6,086 (92%) compile clean after automatic conversion; 531 need source fixes, mostly invalid HTML in docs-mi (178), docs-is (142) and docs-apim (99).
- Single-source products are cheap to bring in: Agent Manager 98%, Developer Platform 94%, Healthcare 94%, Financial Services 94%, Platform Security 100%, Kubernetes Gateway 88%, Updates 86%.
- API Platform and Integration Platform have separate cloud and self-hosted trees and wait on [Combining separate cloud and self-hosted doc sets](15-combine-separate-doc-sets.md); their individual sources convert at 80 to 99%.
- Converter must add `{!file!}`, `--8<--` and `{{#var#}}`, and the conformance check must fail on unexpanded include markers (added to the contract).
