# Navigation across hub and products

Parent: [map](../map.md)
Type: prototype
Status: resolved
Assignee: tharinduj
Blocked by: 04, 05

## Question

What does navigation look like: a HashiCorp-style product switcher, each product's sub-navigation (for example Get started, Docs, API reference), the hub home with the old map's six sections, and where the version selector sits? Prototype it in the skeleton for Identity Platform and Integration Platform. Input: [Hub site tree](../../wso2-cloud-docs/assets/04-hub-site-tree.md).

## Prototype findings (2026-10-06)

Started before [Confirm the product catalogue with product teams](05-confirm-product-catalogue.md) closed, at the user's request, on the draft [Product catalogue](../assets/product-catalogue.md); revisit if the teams change it. Prototype: branch `prototype/navigation`, `prototypes/content-format/site`, http://localhost:3011 with `?nav=A|B|C`. Real converted Identity Platform pages (Latest 7.3.0, plus 7.2.0 and 7.1.0 subsets), sample Integration Platform sections (Cloud, Micro Integrator 4.7.0/4.6.0/4.5.0, WSO2 Integrator 5.1.x/5.0.x) using the real top-level section names, and the hub's six sections.

- One Docusaurus docs set per product section works: each has its own sidebar and version selector; the selector keeps the page when it exists in the target version and otherwise opens the version home; "Older versions" links out.
- Hosting note: URLs whose last segment contains dots (`/integration/micro-integrator/4.6.0/`) 404 on `docusaurus serve`, which treats `4.6.0` as a file name. Hosting must map directory URLs to `index.html` (nginx `try_files $uri $uri/index.html`).

## Answer

Decided with the user, 2026-10-06 (provisional on the draft product catalogue).

- **HashiCorp model (variant A):**
  - Global bar: WSO2 Docs logo (home), "Products" mega-menu (name, one-line description, sections listed for multi-section products; external products such as API Analytics Platform marked ↗), "WSO2 Cloud" link to the hub, search, colour mode.
  - Inside a product: a second bar with the product name, one tab per section when the product has several (Integration Platform: Cloud, Micro Integrator, WSO2 Integrator, …), and the version selector for the active section at the right.
  - Version selector keeps the page when it exists in the target version, else opens that version's home; "Older versions ↗" links to the current MkDocs sites.
- Amended 2026-10-07: the Products menu and home page list every product from wso2.com/documentation, grouped like wso2.com (Agent Management, API Management, Integration, Identity and Access Management, Internal Developer Platform, Solutions, Other), one entry per product; products not yet migrated link out (↗). Section tabs never split cloud from self-hosted (the prototype's "Cloud" tab was wrong).
- **Product name links to a product overview page** that introduces the product, its sections and deployment options, following the hub's product page template ([Hub site tree](../../wso2-cloud-docs/assets/04-hub-site-tree.md)): what it is, deployment options, links (docs, console, getting started, status, support), related products.
- **Home page:** product cards first, then the WSO2 Cloud hub sections.
- Not chosen: sidebar-first selectors (B; weak on mobile), hub-first top bar (C; gives hub sections more weight than products).
- Hosting must map directory URLs with dotted version segments to `index.html`.
- Found after the decision (2026-10-06), fixed on the prototype branch: replacing the whole navbar crashed every page with headings after hydration ("Cannot read properties of null (reading 'clientHeight')"), because Docusaurus `useTOCHighlight` reads `document.querySelector('.navbar').clientHeight` without a null check. The skeleton must keep a `.navbar` element (or swizzle `Navbar/Content` instead of `Navbar`) and keep the mobile sidebar toggle the stock navbar provides. Test pages with headings in a real browser, not only server HTML.
- Sidebar labels in the prototype are raw folder names; the skeleton must build each product sidebar from the content source's MkDocs `nav:` (titles and order). Older-version banner must use the decided text, not Docusaurus's default "no longer actively maintained".

- Prototype updated 2026-10-07 to the revised catalogue (all wso2.com/documentation products, grouped, one entry each; Integration Platform tabs: WSO2 Integrator, Micro Integrator, BI ↗, Streaming Integrator ↗; cloud sample pages inside sections with labels).
- User decision 2026-10-07: the hub link in the global bar is labelled **Account and billing** (not "WSO2 Cloud"), at `/account/`; the home page section uses the same name. Hub pages keep their own deployment label.
