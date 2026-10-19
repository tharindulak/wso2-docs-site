# WSO2 Documentation

Planning and building WSO2's customer-facing product documentation: the WSO2 Cloud hub and the unified docs site that brings each product's cloud and self-hosted docs together.

## Language

### Products and offerings

**WSO2 Cloud**:
WSO2's managed SaaS family of five products: Agent Manager, Identity Platform, API Platform, Integration Platform and API Analytics Platform.
_Avoid_: Cloud platform, Choreo, Devant (as a family name)

**WSO2 Cloud account**:
The single login and organization that gives a customer access to every WSO2 Cloud product.
_Avoid_: Cloud subscription, Asgardeo account

**Product**:
One WSO2 offering as customers buy and use it, documented once across all its deployment options.
_Avoid_: Component, service

**Deployment option**:
A way a customer runs a product: WSO2 Cloud (fully managed SaaS), Hybrid (WSO2-managed control plane with a customer-run data plane) or Self-hosted (customer-run).
_Avoid_: Offering, edition, on-prem (as the label), SaaS (as the label)

**Self-hosted distribution**:
A separately released and versioned self-hosted package of a product, such as Identity Server for Identity Platform, or Micro Integrator and WSO2 Integrator for Integration Platform. Its name is used only in content that applies to Self-hosted alone.
_Avoid_: Self-hosted name, on-prem product, component

**Former name**:
A product name no longer used, such as Asgardeo, Bijira, Devant or Moesif, listed only on the Product names page.
_Avoid_: Legacy name, alias

### Documentation

**Docs site**:
The single Docusaurus site where every product's docs are published under one navigation and one search.
_Avoid_: Portal, docs hub (when meaning the whole site)

**Hub**:
The part of the docs that covers cross-cutting topics for WSO2 Cloud as a whole, rather than any one product.
_Avoid_: Landing site, umbrella docs

**Cross-cutting topic**:
A subject that spans products, such as the WSO2 Cloud account, organizations, billing, regions, SLA, security, support or status.
_Avoid_: Shared topic, common docs

**Content source**:
A product team's own docs repository, which the team owns and from which the docs site draws that product's pages.
_Avoid_: Docs repo (when ambiguous with the docs site's own repository), upstream

**Migration**:
Moving a content source from MkDocs to Docusaurus once, so its writers author Docusaurus content from then on and the docs site copies it instead of converting it.
_Avoid_: Conversion (turning MkDocs into Docusaurus content, done for unmigrated sources on every release or build), port

**Cutover**:
The point in a migration when the product team approves the Docusaurus content and the MkDocs tree is removed; until then the Docusaurus content is generated, never hand-edited.
_Avoid_: Switch-over, go-live (the docs site's launch)

**Docs bundle**:
The archive a content source publishes with each docs release, holding the source of one version of one section (pages, navigation, images, partials, redirects; never rendered HTML) and a manifest describing it. Migrated and unmigrated content sources both publish bundles: an unmigrated source's bundle holds its raw MkDocs content, which the docs site converts. The docs site builds from bundles, never from the repo's working tree.
_Avoid_: Zip, docs artifact, package (ambiguous with the converter's npm package)

**Release bundle**:
A docs bundle for one released self-hosted version, published once per docs release and frozen after.
_Avoid_: Version zip

**Rolling Latest bundle**:
A docs bundle of a section's cloud content (or its whole merged Latest, once migrated), published afresh whenever that content changes; WSO2 Cloud docs only ever reach the docs site this way.
_Avoid_: Nightly, snapshot (a snapshot is the site's frozen build of an older version)

**Site feature**:
Something the docs site adds to every page, or to the site as a whole, without the writer doing anything, such as page feedback, a last-updated date or llms.txt.
_Avoid_: Element (ambiguous), widget, plugin

**Content component**:
A building block a writer places explicitly in a page's source, such as steps, a badge or a prerequisites block. Content not yet migrated gets components from the writing conventions it follows (such as `## Step N:` headings) when it is converted; writers of migrated content place them directly and are held to them.
_Avoid_: Element (ambiguous), shortcode, macro

**Steps**:
A numbered procedure a writer marks with the steps component; each step is a heading, and the site numbers the steps in order.
_Avoid_: Stepper (the visual), procedure block

**Sub-step**:
A step inside a step, numbered from its parent step (1.1, 1.2); only one level deep.
_Avoid_: Nested step

**Prerequisites**:
What a reader needs before starting a task, marked with the prerequisites component.
_Avoid_: Requirements, before-you-begin block

**Link cards**:
A closing list of links to related pages, shown as cards.
_Avoid_: Next-steps cards

**Lifecycle stage**:
Where a feature stands for readers: Beta (available to everyone, may change), Preview (switched on in the Console's Feature Preview first) or Deprecated (still works, not recommended); generally available when none applies. It may differ by deployment option.
_Avoid_: Release stage, launch stage, status (too vague)

**Deprecation notice**:
What a deprecated page or section tells readers: since when the feature is deprecated, what to use instead, and, once the product owner has approved it, when it will be removed.
_Avoid_: Deprecation warning, EOL notice

**Deprecations page**:
The one page per docs version that lists everything deprecated in that version, including deprecations that have no page of their own.
_Avoid_: Deprecation list, changelog (release notes are separate)

**Linked tabs**:
Tab sets anywhere on the docs site that offer the same choices and switch together when a reader picks one, remembering that choice on later pages.
_Avoid_: Synced tabs, tab groups

**Primary reader**:
The reader a page is written for first: a new customer onboarding, or a customer of one product discovering the others.
_Avoid_: Persona, audience
