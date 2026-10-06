# Build-time conversion contract

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharinduj
Blocked by: 07

## Question

Given that the docs site converts MkDocs content at build time ([Content format for content sources](06-content-format.md)), what is the contract with content sources: which MkDocs and Jinja subset they may use (conditions, variables, includes, raw HTML), whether the latent string-compare version bug is kept or fixed (7.10.0 sorting before 7.2.0), what the build does with a page that fails to convert or compile (fail the build, or skip and report), how content repos check conformance before merging (a lint in their CI), and who owns the converter?

## Answer

Decided with the user, 2026-10-06 (Q3 answered "q", read as option (a); Q6 recorded as the docs-site team owning converter, spec and Action).

- **Allowed syntax (written spec, grows only with converter support):** Jinja `if`/`elif`/`else`/`endif` with `==`, `!=`, `<`, `>`, `<=`, `>=`, `and`, `or`, `not`, `in`, `is defined`; `include` (resolving inside the repo only); `set`; `raw`; `{{ variable }}` with dotted names. MkDocs admonitions, collapsibles (`???`), tabs (`===`), `attr_list` (stripped), fenced code. Not allowed: inline ternaries (1 use in docs-is today), filters, macros, loops. Conditions are parsed by an allow-listed grammar, never evaluated as code.
- **HTML allow-list (safety boundary for auto-merged bumps):** formatting and table tags pass. Conversion fails on any `on…` attribute, `javascript:` URL, `<script>`, `<style>`, `<form>`, `<object>`, `<embed>`; `<iframe>` only from allow-listed hosts (YouTube). One recognised exception: the quick-start `<script>const meta = …</script>` pattern converts to front matter. Recommend security review of the allow-list before launch.
- **Failures:** a page that fails to convert or compile fails the bump PR; it does not merge, the site keeps the last good SHA, and the bot opens a docs-site issue naming page and error. Each source has a temporary exclude list in the lock file for onboarding (docs-is: ~142 pages today) that may only shrink.
- **Pre-merge checks:** the converter's check ships as a GitHub Action (content repos pin it by SHA, run on PRs) and as an npm CLI for local runs. Same code as the build.
- **Version comparison:** the converter compares version-shaped values numerically (fixes 7.10.0 sorting before 7.2.0; identical results for all versions today). The check warns on conditions that can never match, such as the two `"WSO2 Identity Server "` trailing-space cases.
- **Navigation source:** the converter also turns each content source's MkDocs `nav:` into the Docusaurus sidebar (titles, order); folder names are not usable labels (found in the navigation prototype). Older versions are rendered from their own pinned source, never copied from Latest.
- **Ownership:** the docs-site team owns the converter, the spec and the Action; each product docs team owns its content passing and its exclude list.
