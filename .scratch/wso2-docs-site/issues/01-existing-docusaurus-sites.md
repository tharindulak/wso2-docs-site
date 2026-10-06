# How the existing WSO2 Docusaurus sites are built

Parent: [map](../map.md)
Type: research
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

How are docs-wso2cloud, docs-agent-platform and docs-integrator built (Docusaurus version, plugins, theme customisation, versioning, search, CI and hosting config visible in the repo), and which parts can the new docs site reuse? Note the agent-platform "cloud" pseudo-version and how it is implemented. Starting facts: [Initial facts](../research/00-initial-facts.md).

## Answer

Resolved by research, 2026-10-06. Full findings: [Existing Docusaurus sites](../research/01-existing-docusaurus-sites.md).

- Three single-instance Docusaurus 3.9/3.10 sites, each with different search (easyops local, lunr, Algolia configured but off) and hosting (WSO2 Cloud container image, GitHub Pages, gh-pages branch).
- Agent Manager's "cloud" pseudo-version is a hand-forked `versioned_docs` copy: 53 pages, already drifting from Next on 26 of 38 shared pages. Evidence against a separate cloud version track; supports the GitLab model.
- Docusaurus Faster (`v4: true`) broke on near-identical versioned MDX in docs-agent-platform; relevant to [Versioning details](08-versioning-details.md).
- Reusable: container/nginx hosting setup, shared theme CSS (`amp-theme.css`), CI checks (audit-ci, linkinator), Vercel PR previews that keep secrets from fork code, llms-txt helpers, release automation.
- Avoid copying: the hand-forked cloud version, integrator's single-instance `Root` and sidebar plugins.
