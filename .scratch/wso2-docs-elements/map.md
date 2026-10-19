# Map: Site features and content components for the WSO2 docs site

Label: wayfinder:map

## Destination

A decided shortlist of site features and content components for the docs site, each with a short spec (behaviour, data it collects, MkDocs syntax for content components, owner, risks and reviews needed), ready to hand to whoever builds it. A small "for WSO2Con" set is decided by late October 2026; the remaining candidates are ranked afterwards, with no date.

## Notes

- Domain: documentation platform. Vocabulary lives in [CONTEXT.md](../../CONTEXT.md); this map covers both **Site features** and **Content components** (defined there 2026-10-12; content components brought into scope by the user the same day).
- Follows on from [WSO2 docs site on Docusaurus](../wso2-docs-site/map.md). Baseline: [Documentation elements to consider](../wso2-docs-site/research/17-documentation-elements.md) (2026-10-09), section A (site features) and section B (content components).
- Planning only: produce decisions and specs, not builds.
- Content components already built or decided on the main map (tabs, includes, variables, conditionals, admonitions, deployment-option label) keep their base syntax in [Build-time conversion contract](../wso2-docs-site/issues/13-conversion-contract.md); this map only covers extensions to them (for example synced tabs).
- Fact (2026-10-13): features current sites already give readers, which the new site would drop if absent: Copy as Markdown and llms.txt (Agent Manager; Markdown export on Integrator), last-updated date (Agent Manager, Integrator, SI via `git-revision-date-localized`), linked tabs (BI, Devant, MI, Security), image lightbox (API Platform, Choreo, IS, MI, Security), code line numbers (11 of 12 MkDocs sources). Agent Manager also has an Algolia Ask AI assistant configured but off.
- Fact (2026-10-12): about 1,120 pages across 12 content sources already write procedures as `## Step N:` headings; no source uses dedicated steps syntax.
- Reference sites: GitLab, HashiCorp (Terraform), Microsoft Learn (Azure), Stripe, Cloudflare, GitHub Docs (user decision 2026-10-12).
- WSO2Con set qualifies only if all hold: no third-party script, no personal data collected, no work for product teams, buildable by the docs-site team in a few days. Page feedback is not in the WSO2Con set (user decision 2026-10-12).
- Features needing legal, privacy or security review stay candidates; their spec records the review needed. Starting that review is outside this map.
- Approval: the user decides in grilling tickets; the docs team signs off the final shortlist in one task ticket.
- Fact (2026-10-12, from repo source, live sites not checked): current WSO2 docs sites load Google Tag Manager, mostly one shared container; CookiePro consent only on APIM, Choreo and Agent Platform; no site has a page feedback widget.
- Prototype (2026-10-12): the suggested WSO2 option for each candidate on a real Identity page, with screenshots: `prototypes/docs-components/` (run `python3 prototypes/docs-components/build.py`, open `index.html`; needs the site on :3020). Sample content and statuses are made up.
- Skills every session should consult: grilling, domain-modeling. Research tickets use research; prototype tickets use prototype.
- Treat findings as planning input for human review; flag security, licensing, privacy and supply-chain concerns for any new dependency.

## Decisions so far

<!-- one line per closed ticket -->

- [How reference docs sites implement site features](issues/01-site-features-research.md): Markdown output and llms.txt are cheap and script-free; last-updated is rare (Cloudflare uses git author date); page feedback always needs a script; docs MCP servers that act in the product need security review; 18 features research 17 missed.
- [Patterns writers already hand-build in our content sources](issues/08-content-source-patterns.md): prerequisites (1,288 pages), Step headings (1,035) and closing sections (844) are common and detectable; tab labels are too varied to sync without a normalisation map; version notes, status labels and required roles are rare or free prose.
- [How reference docs sites implement content components](issues/07-content-components-research.md): mostly style-guide conventions with linting, not code; GitLab leads on lifecycle and feature history; our converter loses the label-based tab sync several sources rely on; HashiCorp code is reading only.
- [Spec: automatic stepper from Step headings](issues/09-automatic-stepper.md): style A (circles and a line), `remark-steps` in the site build, `stepper: false` opt-out; built in `7f9e4e2` on `docs-is-migrate`.

## Not yet specified

- Ranking the candidates left after the WSO2Con set: page feedback (Yes/No, then comments), release notes / changelog with RSS, related content and next steps, glossary tooltips, AI chat, "Open in ChatGPT/Claude", docs MCP server, API try-it and request samples, personalised samples, PDF download, tutorials hub. Likely one ticket per cluster once the WSO2Con set is decided.
- Whether and how the docs site loads analytics (the shared GTM container behind CookiePro consent, as Agent Platform does). Becomes sharp when page feedback or any measured feature is ranked.
- Image component spec (prototyped 2026-10-13, tag 23): light/dark pairs stay optional (about 36 of 20,000 image references have one today); the site frames single images in dark mode and puts a light panel behind transparent ones; check warns only on half-pairs and transparent PNGs without a pair. Open: caption syntax (`/// caption` support per source), lightbox dependency, size limit, mapping of `{: .cInlineImage-* }` sizing classes (87 pages) and width attr_lists (601 pages), dropping MI's 902 hand-written `class="glightbox"`. Builds on research 17 B14 and [07](research/07-content-components.md) section 9.
- Ranking the content components left after the WSO2Con set, and which need a new MkDocs syntax that product teams must adopt.
- Spec template: what every feature spec must contain, if the first specs show a pattern worth fixing.

## Out of scope

- [Spec: llms.txt and Markdown output](issues/03-markdown-and-llms-txt.md): moved to [AI-friendly docs scope](../wso2-docs-rollout/issues/07-ai-friendly-docs.md) on the rollout map, which decided the scope (2026-10-14).

- Building stepper, prerequisites block, closing sections and linked tabs on Identity Platform: [Content components on Identity Platform](../wso2-docs-is-components/map.md). [Spec: keep linked tabs working](issues/10-linked-tabs.md) moved there.

- Search: owned by [Search choice and behaviour](../wso2-docs-site/issues/11-search-choice.md) and [DocSearch legal review](../wso2-docs-site/issues/12-docsearch-legal-review.md).
- Product overview / landing pages: owned by [Navigation across hub and products](../wso2-docs-site/issues/10-navigation.md).
- Internationalisation: fog on the [main map](../wso2-docs-site/map.md).
- Older-version banner: built (commit 671f12a), owned by the [versions map](../wso2-docs-site-versions/map.md).
- Mobile Products menu: a skeleton bug, owned by [Build the skeleton](../wso2-docs-site/issues/14-build-skeleton.md).
- Building any feature, and starting any legal, privacy or security review.
