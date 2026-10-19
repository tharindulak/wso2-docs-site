# Map: Docs site redesign (new look on Oxygen UI)

Label: wayfinder:map

## Destination

The docs site restyled to the approved design direction ("WSO2 Cloud Docs - Version 1" mockups), built on the real site with the latest `@wso2/oxygen-ui` package imported. Latest of every product shows the new look by WSO2Con (2026-11-20); older versions follow after.

## Notes

- Domain: documentation platform. Vocabulary lives in [CONTEXT.md](../../CONTEXT.md) (Docs site, Product, Hub, Deployment option, Content component). The design's names (Platform, Agent, Analytics, Labs, Solutions) are placeholders; CONTEXT.md stays authoritative (user decision 2026-10-19).
- **Execution is in scope** (user decision 2026-10-19): this map carries the build, not only the plan. Tickets may be build tasks once the decisions they need are closed.
- Design file: `~/Downloads/WSO2 Cloud Docs - Version 1 (2).html` (bundled page; needs JavaScript to render). It holds mockup 1 (cloud landing page), 2 (platform doc page), 3 (separate self-hosted product site with a cloud banner) and variants 2A to 2C (Cloud/Releases switches). Screenshots: render with headless Chrome; not committed.
- Scope is the **look only** (user decision 2026-10-19). The structure stays as decided on [WSO2 docs site on Docusaurus](../wso2-docs-site/map.md): one docs site, one entry per product, merged cloud and self-hosted pages, no cloud/self-hosted toggle.
- The design file is the approved direction for the look. Where it and Oxygen UI disagree (colour, type, spacing), **Oxygen UI wins** (user decisions 2026-10-19).
- Importing the real `@wso2/oxygen-ui` package at its latest version is **required** (user decision 2026-10-19). This supersedes "variant C now, real package later" in [How Oxygen UI themes the docs site](../wso2-docs-site/issues/04-oxygen-ui-in-docusaurus.md). What 0.16.0 can and cannot do: [Oxygen UI 0.16 in the docs site](issues/01-oxygen-ui-016-in-docusaurus.md). The site today copies Oxygen colours by hand (`site/src/css/oxygen.css`, `site/src/components/MuiIsland.js`), primary orange `#FF7300`; the design uses blue.
- Fidelity: same layout, spacing and components as the mockups, styled by Oxygen; checked by side-by-side screenshots of three reference pages: home, a product overview, a deep how-to page (user decision 2026-10-19).
- Decided while charting (2026-10-19): no language picker (the site has no translations); the footer copies the design's pattern with link targets taken from the [WSO2 Cloud hub documentation plan](../wso2-cloud-docs/map.md), dropping any link without an owner; the first version restyles Latest only.
- Sign-off: the user signs off each prototype ticket; the design file's owner reviews the three reference pages before WSO2Con. Who that is was set aside by the user (2026-10-19); it only blocks Design owner review.
- Deadline: WSO2Con, 2026-11-20. Each decision says whether it is launch-critical.
- Facts: a site chrome change changes every snapshot key, so older versions keep the old look until all 33 are rebuilt (several hours). Builds need `DOCS_SITE_TEST_OWNER=tharindulak`, a 12 GB heap and about 30 GB free disk (a quick build failed with ENOSPC at 11 GB free, 2026-10-19).
- Skills every session should consult: grilling, domain-modeling. Research tickets use research; prototype tickets use prototype.
- Flag security, licensing and supply-chain concerns for every new dependency (Oxygen UI and its peers); treat findings as input for human review.

## Decisions so far

<!-- one line per closed ticket -->

- [What the design file specifies](issues/02-design-file-inventory.md): layout and sizes mostly fit Oxygen; colours, font, heading weight and shadows do not, so the build keeps the layout and takes Oxygen's look; admonition style to pick in the doc page prototype.
- [Oxygen UI 0.16 in the docs site](issues/01-oxygen-ui-016-in-docusaurus.md): still not tree-shakeable (+422 KB gzip per page for any browser import), no `theme.css`; works as a build-time tokens source at 0 KB per page; no WSO2 blue theme (PaleIndigo closest); security flags on URL themes and bundled agent instructions.
- [How the site imports Oxygen UI](issues/09-oxygen-import-mode.md): at build time, pinned 0.16.0, generated CSS variables, plain MUI islands (0 KB per page); deliberate upgrades with a reviewed diff; React pin accepted.
- [Which Oxygen theme styles the docs site](issues/10-oxygen-theme-choice.md): WSO2Theme orange, links #B25000 for contrast; corner radii from the mockups, not the theme's 20.
- [Which parts of the site get the new look for WSO2Con](issues/03-launch-critical-parts.md): all chrome, page furniture, boxes, cards, footer, home page and product picker; code blocks, tables, API pages and search dialog after launch.
- [Footer and call-to-action link targets](issues/04-footer-links.md): Docs, Products and Help columns from the hub and CONTEXT.md; forum, GitHub and blog dropped; console button held until its address is approved; legal links to WSO2's pages once confirmed.

## Not yet specified

- Older versions in the new look: rebuilding all 33 snapshots after Latest ships, and whether the build pipeline needs changes to make that routine.
- Styling of code blocks, tables, API reference (Redoc) pages and the search dialog after launch (decided as post-launch), using Oxygen components where they exist.
- Mobile and narrow layouts: the mockups are desktop only.
- Dark mode in the new look: the mockups show light only; depends on what Oxygen's theme provides.
- Home page content: the mockup's sections (what you get, product cards) against the hub's decided sections.

## Out of scope

- Structural parts of the design, ruled out by the look-only scope (user decision 2026-10-19): a separate cloud docs site with a "Platform" sidebar group; Labs and Solutions tiers; separate self-hosted product sites with a cloud banner (mockup 3); Cloud/Releases switches (2A, 2B, 2C).
- Renaming products to the design's names: a decision for product marketing, not this map.
