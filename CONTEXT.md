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
