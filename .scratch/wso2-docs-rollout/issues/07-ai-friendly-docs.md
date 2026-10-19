# AI-friendly docs scope

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharindulak
Blocked by:

## Question

Spec for the AI-friendly output decided in charting: `llms.txt`, `llms-full.txt`, a `.md` URL per page, and "Copy as Markdown". Covers: site-wide vs per-product and per-version files (and size limits for `llms-full.txt`); URL scheme; generated from bundles or from the built site; how deployment-option labels, `<Applies>` blocks, partials and content components appear in Markdown; whether frozen snapshots get them; build in-house vs a third-party Docusaurus plugin (licence, maintenance, supply chain); and how agents find the files (`robots.txt`, link headers). Takes over [Spec: llms.txt and Markdown output](../../wso2-docs-elements/issues/03-markdown-and-llms-txt.md) and drops its wait on the WSO2Con set. Inputs: [How reference docs sites implement site features](../../wso2-docs-elements/issues/01-site-features-research.md); Agent Manager's existing implementation.

## Answer

Decided with the user, 2026-10-14, accepting every recommendation.

Facts:
- [AI-friendly docs facts](../research/07-ai-friendly-docs-facts.md): llms.txt spec v2 allows nested files per subpath; sizes and shapes at Cloudflare, Mintlify, Next.js, Vercel and Anthropic; plugin survey; agent usage evidence.
- Nothing exists in the site code yet.
- Agent Manager uses `@signalwire/docusaurus-plugin-llms-txt` 1.2.2 with a copy button and "Open in ChatGPT/Claude/Perplexity" links.
- Plugin `postBuild` hooks see only the live build.
- Identity Latest has about 5 MB of article text.

- **Generation:** our own MDX-to-Markdown step in `@wso2/docs-converter`, one rule per component, no third-party plugin. Rejected:
  - `docusaurus-plugin-llms`: no LICENSE file in its repo, and stripping source tags loses `<DeploymentValue>` props.
  - `@signalwire/…`: HTML conversion loses `<Applies>` boundaries; last stable release July 2025.
- **Components in Markdown:** an agent sees everything a reader could see, with deployment options labelled, never filtered.
  - `<Applies>`: a labelled block (`> **WSO2 Cloud only:** …`).
  - `<DeploymentValue>`: both values inline.
  - Tabs: every tab under a bold label.
  - Partials: expanded in place.
  - Stepper and prerequisites: as written in the source.
  - Lifecycle and deprecation: one status line under the title.
  - Link cards: a plain link list.
  - Front matter: only title and description kept.
- **Files and URLs:**
  - `<page>.md` for every page, plus `<link rel="alternate" type="text/markdown">` in its HTML.
  - A root `/llms.txt` indexing products and hub pages.
  - `/<product>/llms.txt` at Latest, and `/<product>/<version>/llms.txt` for each older version.
  - `/<product>/llms-full.txt` at Latest only; no site-wide `llms-full.txt`.
- **Versions:** every version, including frozen snapshots, generated from source inside each snapshot build. This is a one-time rebuild of every snapshot, because the build code is part of each snapshot's cache key.
- **Reader UI:** a "Copy page" button and a "View as Markdown" link. No "Open in ChatGPT/Claude/Perplexity": those links stay out pending privacy and security review. **Known loss:** Agent Manager readers have these links today and will lose them.
- **AI crawlers in `robots.txt`:** recommended to allow. This is WSO2 policy, so it is not decided here: [Approve the AI crawler policy](09-ai-crawler-policy.md).
- **Host-dependent, deferred:** Markdown on `Accept: text/markdown` and HTTP `Link:` headers wait on hosting.
