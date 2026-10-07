# Versioning details

Parent: [map](../map.md)
Type: grilling
Status: resolved
Assignee: tharinduj
Blocked by: 07

## Question

Under the GitLab model (Latest holds WSO2 Cloud plus the newest self-hosted release; older releases are frozen snapshots), how many self-hosted versions does each product keep on the site, where do older ones go, what is the URL scheme, and what does a reader see on an old version for a page whose deployment-option label includes WSO2 Cloud? Docusaurus advises fewer than 10 versions per docs instance.

## Answer

Decided with the user, 2026-10-06.

- **Versions kept on the site:** Latest plus the 2 previous self-hosted releases per self-hosted distribution (Identity Server: 7.3.0 Latest, 7.2.0, 7.1.0).
- **Older versions** stay on their current MkDocs sites (for example is.docs.wso2.com), linked from the version selector under "Older versions". A static archive is a later option.
- **URLs:** Latest has no version segment, older versions use the full release number: `/identity/guides/…`, `/identity/7.2.0/guides/…`.
- **Older version pages:** banner "You're viewing Self-hosted 7.2.0. For WSO2 Cloud and the latest release, see Latest"; every page labelled "Deployment options: Self-hosted"; a page missing in that version redirects to the version's home instead of a 404.
- **Products with several self-hosted distributions** (Integration Platform: Micro Integrator, WSO2 Integrator, ICP, BI): one versioned section per distribution inside the product, each with its own version selector; cloud docs (Devant) sit alongside, unversioned. Cloud and self-hosted merge only where they share sources (today only Identity Platform). Confirm with the Integration team in [Confirm the product catalogue with product teams](05-confirm-product-catalogue.md).
- **Promoting Latest on release:** the bump bot also checks each distribution's product repo for new non-prerelease GitHub releases (for example `v7.4.0` on `wso2/product-is`) and finds the docs source by convention (folder `en/identity-server/7.4.0` in docs-is, branch `4.8.0` in docs-mi). It opens a lock-file PR: `latest` moves to the new release, the previous Latest becomes archived, the oldest kept version moves to "Older versions". This PR needs one approval from the product's docs team (content bumps stay automatic). If the docs source does not exist yet, the bot opens a docs-site issue instead.
- Amended 2026-10-07: there is no separate unversioned cloud section. Cloud pages (for example Devant) sit inside the section they belong to, labelled WSO2 Cloud, and appear only in Latest; see [Combining separate cloud and self-hosted doc sets](15-combine-separate-doc-sets.md).
- Lock file gains a `product_repo` per self-hosted distribution for release detection.
- Watch: Docusaurus Faster (`future.v4`) failed on near-identical versioned MDX in docs-agent-platform ([Existing Docusaurus sites](01-existing-docusaurus-sites.md)); test with three versions before enabling it.
