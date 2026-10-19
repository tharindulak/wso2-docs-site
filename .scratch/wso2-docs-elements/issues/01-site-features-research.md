# How reference docs sites implement site features

Parent: [map](../map.md)
Type: research
Status: closed
Assignee: tharinduj
Blocked by:

## Question

For GitLab, HashiCorp (Terraform), Microsoft Learn (Azure), Stripe, Cloudflare and GitHub Docs, how does each implement the site features in [research 17](../../wso2-docs-site/research/17-documentation-elements.md) section A (excluding search, landing pages, i18n, version banner, mobile menu)? For each feature: what the reader sees and where, how it is generated (build time or runtime, source of data), what data it collects or sends, third-party services involved, and any open-source implementation with its licence. Flag features none of them have that research 17 missed.

Research: [01 Site features](../research/01-site-features.md)

## Answer

Resolved 2026-10-12 by [01 Site features](../research/01-site-features.md). Gist for the next tickets:

- View as Markdown is cheap and needs no third party; don't ship raw shortcodes (GitLab) or author/reviewer metadata (Microsoft) in it.
- llms.txt on 4 of 6 sites; only Cloudflare serves llms-full.txt (67.6 MB, plus per product).
- Last-updated shown only by Cloudflare (git author date, front-matter override) and Microsoft (undocumented rule).
- Page feedback always needs a script (Firestore + reCAPTCHA, Turnstile, Microsoft Forms).
- Docs MCP: Microsoft and Cloudflare read-only; Stripe and HashiCorp also act in the product (security review).
- Licence flags: hashicorp/web-unified-docs BUSL-1.1, dev-portal MPL-2.0, GitLab content CC BY-SA.
- Corrects research 17 on Cloudflare's stack, HashiCorp feedback, GitHub llms-full.txt, and who has the ChatGPT/Claude menu; lists 18 features it missed.
