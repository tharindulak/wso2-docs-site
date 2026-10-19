# How reference docs sites implement content components

Parent: [map](../map.md)
Type: research
Status: closed
Assignee: tharinduj
Blocked by:

## Question

For GitLab, HashiCorp (Terraform), Microsoft Learn (Azure), Stripe, Cloudflare and GitHub Docs, how does each implement the content components in [research 17](../../wso2-docs-site/research/17-documentation-elements.md) section B that our site lacks (steps, lifecycle badges, feature history, prerequisites and required roles, closing sections, deprecation notices, synced tabs and tool switchers, extended alert types, image conventions, code block extras, config in two formats, limits tables, quick-start metadata, topic types and front matter)? For each: the authoring syntax, how it renders, whether it is required or validated at build time, how it degrades when absent, and any open-source implementation with its licence. Flag components research 17 missed.

Research: [07 Content components](../research/07-content-components.md)

## Answer

Resolved 2026-10-12 by [07 Content components](../research/07-content-components.md). Gist:

- Mostly conventions, not code: prerequisites, closings, deprecations and topic types are headings or alerts backed by a style guide, enforced at most by a linter (GitLab Vale, GitHub markdownlint). Only GitHub renders `permissions:` front matter as a box.
- Synced tabs: several content sources enable Material's `content.tabs.link` (label-based sync); our converter numbers tabs by position (`value="tab-N"`, `packages/docs-converter/src/syntax.ts:93`, checked 2026-10-12), so that behaviour is lost. Reference sites sync by a stable id.
- Steps: Cloudflare `<Steps>` is CSS over an ordered list; GitLab `guide` is tutorial-only.
- Lifecycle and feature history: mainly GitLab (availability-box status, collapsible `history`, lint-checked, YAML-generated deprecations page). Cloudflare now advises against inline badges.
- Worth copying: GitLab editable placeholders, Material code annotations. Cloudflare `WranglerConfig` depends on `@iarna/toml`, unpublished since 2020 (supply-chain flag).
- HashiCorp code is MPL-2.0 / BUSL-1.1: reading only. Lists 15 components research 17 missed.
