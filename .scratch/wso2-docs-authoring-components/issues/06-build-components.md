# Build the explicit components on one rendering path

Parent: [map](../map.md)
Type: task
Status: closed
Assignee: tharinduj
Blocked by: 04

## Question

AFK, test-first: register the components as decided; the site renders only them; the convention plugins (remark-steps, remark-prerequisites, remark-link-cards, deprecated sections) become converter steps that produce them, for MkDocs products on every build and for the one-off Identity rewrite. Rebuilt preview unchanged in appearance; tests.

## Answer

Built 2026-10-14 (AFK, test-first): commit `389d7bf` on `docs-is-migrate` (28 files).

- **Components** (global, no imports): `<Steps start={n}>` (headings at the first level inside are steps; a nested `<Steps>` gives N.M sub-steps with the filled badge; deeper nesting only groups); `<Prerequisites>` (wraps the writer's heading, or `title="…"` with no heading); `<LinkCards>` (wraps a Markdown list). `{/* #id */}` sets a heading id inside JSX (Docusaurus 3.10.2 honours it). Markup is the same as before, so pages look identical.
- **One rendering path:** the site renders only explicit components (`src/remark-components.ts`); `remark-steps`, `remark-prerequisites` and `remark-link-cards` are gone. Convention recognition runs only in the converter step `writeComponents` (`src/conventions.ts`): it writes `<Steps>` with old anchors as `{/* #step-… */}`, nested `<Steps>` closed at the next non-sub-step heading, `<Prerequisites>` (heading or `title` form) and `<LinkCards>`; idempotent; skips content already in a component; keeps the opt-outs for MkDocs sources. Runs on every MkDocs page that compiles as MDX.
- **Temporary (remove after [Rewrite the docs-is tree to explicit components](07-rewrite-tree.md)):** `prepareDocusaurusDocs` in `site.ts` applies the converter step to the Identity tree (one line marked TEMPORARY); left in, it would hide writer mistakes.
- Tests: converter 260/260 (old plugin tests ported to convention-then-render tests), scripts and site 123/123. Identity content: 1,065 pages, no new failures; Latest has 87 `<Steps>`, 125 `<Prerequisites>`, 75 `<Prerequisites title>`, 27 `<LinkCards>`.
- Build into `site/build-preview-next` (Latest only; the served build untouched): warnings identical. Across 1,353 pages, 1,339 identical in ids, TOC, step numbers and component counts; the six named pages identical in article markup and anchors. Differences: 8 pages' TOC text normalised to "Step N: " (ids unchanged), two TOC spacing fixes, one duplicate sub-step renumbered (onfido usage 1.3 → 1.4), and **3 CommonMark pages lose their prerequisites panel** until the rewrite fixes them (`enable-java-security-manager`, `try-it-application`, `try-your-own-app/javascript`).
- Concerns: old anchors use the converter's own slug rules (no drift seen on real content); the sub-step review list belongs to the rewrite; a Step run nested inside another step is not wrapped (none in Identity); every product's snapshots rebuild on the next snapshot run (keys cover converter and site code); MkDocs writers need `start="2"` (braces are escaped there).

