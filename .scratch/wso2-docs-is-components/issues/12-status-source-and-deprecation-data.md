# Where status is written, and what a deprecation carries

Parent: [map](../map.md)
Type: grilling
Status: closed
Assignee: tharinduj
Blocked by: 10, 11

## Question

Where does a writer mark status: page front matter (field name and values), a section convention (heading suffix, admonition type), or a central list? What does a deprecation carry: deprecated since (date or version), removal date, replacement link, reason? Who keeps it current, and how does the central Deprecations page get its entries (collected from pages, or a separate data file)? Must work in MkDocs before cutover.

Input (from [Which lifecycle stages, and what each means](11-lifecycle-stages.md)): values Beta, Preview, Deprecated, optionally scoped to a deployment option; every version is marked; one Deprecations page per version, built from that version's Deprecated pages.

Input (from [How status front matter reaches the site](10-status-front-matter.md)): the converter's front-matter allow-list and merged-page rule (Cloud wins) must change; Material's `status` name is free to reuse; deprecations without a page need a hand-kept list; removal dates need product-owner approval.

## Answer

Resolved 2026-10-14 by grilling (user decisions).

- **Page level:** front matter `status: beta | preview | deprecated` (one lowercase string; Material's name and shape). No field means generally available.
- **By deployment option:** each source file says its own stage (the WSO2 Cloud copy under `en/asgardeo/`, the self-hosted copy under `en/identity-server/<version>/`). The converter merges `status` per deployment option instead of "the cloud copy wins" (`site.ts:567`); no scope field.
- **Section level:** new admonition types `!!! beta`, `!!! preview`, `!!! deprecated` (optional title). Existing `!!! warning "Beta feature"` and `!!! warning "Deprecated …"` admonitions are recognised as the same notices, so nothing must be rewritten.
- **A deprecation records:** `deprecated_since` (required; self-hosted version such as `"7.3.0"` or WSO2 Cloud month such as `"2026-09"`, quoted), `replacement` (optional; relative `.md` path or URL, through the converter's unsafe-URL check), `removal` (optional; only once the product owner has approved it, as it is a public commitment). The reason stays in the page text. Section-level deprecations use the same fields as admonition options.
- **Deprecations without a page:** a hand-kept `deprecations.yml` beside each version's `mkdocs.yml` (title, the same fields, optional link), merged into that version's Deprecations page.
- **Bad values:** `wso2-docs check` fails on an unknown `status`, a missing `deprecated_since`, or an unsafe `replacement`; the site build warns; YAML errors in any front matter are reported instead of silently dropping it.

