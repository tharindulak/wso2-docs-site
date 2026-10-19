# Doc page in the new look

Parent: [map](../map.md)
Type: prototype
Status: closed
Assignee: tharinduj
Blocked by: 01, 02, 03, 09, 10

## Question

How should a product doc page look in the new design on Oxygen UI? Prototype on the real site: header, sidebar, breadcrumbs, body, table of contents, admonitions, cards, Steps and Prerequisites, last updated and edit link, previous/next, footer. Use two reference pages: a product overview and a deep how-to page. Show side-by-side screenshots against mockup 2 for sign-off. Pick one admonition style (the design's info and tip boxes differ in radius and padding). Layout values: [What the design file specifies](02-design-file-inventory.md).

## Answer

Signed off by the user, 2026-10-19: **variant A (mockup on Oxygen)**. Prototype (primary source): branch `prototype/redesign-doc-page` at bbb9ea6 on the docs-site repo, two variants switchable with `?variant=a|b` in builds made with `PROTOTYPE_VARIANTS=1`; reviewed on API Platform's Platform section (overview, Manage Paid Subscription Plans, Getting Started with API Monetization).

- Layout from mockup 2: 64 px header with a 1 px divider and a "W" mark; 300 px grey sidebar; content against the sidebar up to 840 px with 56 px padding; 252 px "On this page" with an uppercase label and a primary mark; slash breadcrumbs; bordered previous/next; dark footer with the decided columns.
- Variant A styling: bold headings (h1 36 px, h2 24 px), body 15 px / 1.7; active sidebar row tinted with the primary colour; admonitions with a 3 px coloured left bar and 8 px corners (this settles the design's two admonition styles); soft shadows on cards and the Prerequisites box. Colours and font from Oxygen (generated tokens).
- Changes asked for during review: section dividers (`---`) are not drawn in page content; the search box is centred in the header on desktop; the version selector is a pill in the header after the Products menu (removed from the product bar).
- Real parts to fold in from the branch: `@wso2/oxygen-ui` 0.16.0 pinned as a build-time dependency; `scripts/oxygen-tokens.mjs` and the generated `site/src/css/oxygen-tokens.css` (18 wrong values corrected); `oxygen.css` mapped onto it; the header version pill (`VersionSelect` `pill`, `Navbar/Content`, `ProductBar`); variant A rules from `redesign.css`. Drop: variant B rules, `Root.js` and the switcher, `prototypeVariants`.
- Open (asked, not answered): hide the version pill when a section has a single version (recommended yes).
- Not from the redesign: the API Platform overview shows its architecture diagram twice (light and dark); check the light/dark image conversion separately.
- Decided after sign-off (user, 2026-10-19): the product bar (product name and section tabs) is removed from every product, with **no section switcher** (sections reached through page links and breadcrumbs; a sidebar, header or menu switcher was offered and declined). Supersedes the product bar of [WSO2 docs site on Docusaurus](../../wso2-docs-site/map.md).
- Folded into branch `redesign/new-look` (6bd5c2d): variant A only, no switcher, product bar removed.
