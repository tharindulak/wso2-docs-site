# Rollout order and cut line

Parent: [map](../map.md)
Type: grilling
Status: closed
Assignee: tharinduj
Blocked by: 15

## Question

Using the pilot's measurements, in what order do the remaining sections get their older versions (API Manager, Kubernetes Gateway, Streaming Integrator, BI, Financial Services, API Platform components, Agent Manager), and which versions are cut if WSO2Con time runs short? Includes whether the live window stays at Latest plus the previous release.

## Answer

Decided with the user on 2026-10-11, ahead of [Finish the pilot sign-off](15-finish-pilot-sign-off.md) (the user chose not to wait for it). No cut line: every published version with source goes in now, on branch `docs-site-versions`; `live_window` stays 1.

- **Order:** small sections first (Streaming Integrator 4.3.1 and 4.3.0; Kubernetes Gateway 1.2.0 to 1.0.0; Financial Services 3.0.0 plus 4 Confluence links), then the API Platform split, then API Manager (4.6.0 to 3.0.0 plus 8 Confluence links; 4.2.0, 4.1.0 and 4.0.0 last).
- **Kubernetes Gateway:** Latest moves to branch `1.3.0` (what `apk.docs.wso2.com` serves); 2.0.0 stays out.
- **Financial Services:** Latest stays on `master`. The live site serves master's layout: `/en/latest/develop/java/developer-guide/` and the master-only `develop/openapi/customize-consent-manager-portal-openapi/` exist, and the 4.0.0-branch path `develop/developer-guide/` goes to page-not-found (checked in a browser 2026-10-11).
- **API Platform:** split now. API Gateway, AI Gateway, API Portal and AI Workspace become their own sections with version lists, sourced from the version folders on `wso2/docs-api-platform` main, not the component branches (personal-fork dependency). Their URLs change; old URLs redirect.
- **API Manager 4.2.0, 4.1.0, 4.0.0** (about 1,400 pages each): tried with the 12 GB heap; one that runs out of memory is listed under Older versions as a link to its former site and reported.
- **No older versions:** BI, WSO2 Integrator and Agent Manager have no published older versions; they stay Latest only.

## Outcome (2026-10-12)

The rollout ran on branch `docs-site-versions`, from 0a5a2ea to f89c0f5. It is not merged and not pushed.

**Versions now served:**
- **Every published version with source:** Identity Platform, Micro Integrator, Streaming Integrator, API Manager (4.7.0 down to 3.0.0), API Gateway, AI Gateway, API Portal, AI Workspace, Kubernetes Gateway and Open Banking.
- **Older versions as links:** Confluence spaces, plus Enterprise Integrator on ei.docs.wso2.com.
- **API Manager 4.2.0 to 4.0.0:** none ran out of memory.

**Converter fixes found along the way:**
- MkDocs page titles (file-id headings went from 645 to 56, and the remaining 56 are real titles).
- Custom home layouts.
- `/en/<ver>/` former-site links and assets.
- README as folder index.
- Spaces and line breaks in link targets.
- Inline Markdown in nested HTML (raw-Markdown sequences went from 470 to 47, all source).
- The `javascript:` URL policy.
- Symlink containment.

**Assembly:** root redirects for older versions without an index page.

**Merged gate:** 6,115 broken links, all in baselines, 0 new. Every added baseline entry is proven to be source breakage, apart from 7 root-relative links without their version prefix, accepted by ruling.

**Measurements:** in [Rollout measurements](../research/16-rollout-measurements.md). The live build takes 570 s at 6.7 GB; the 33 snapshots take about 42 min.

**Open:**
- Docusaurus Faster and a two-version live window: not measured, because the machine was swapping ([Finish the pilot sign-off](15-finish-pilot-sign-off.md)).
- The remaining converter link work and source breakage ([Fix link conversion](14-fix-link-conversion-older-versions.md)).
