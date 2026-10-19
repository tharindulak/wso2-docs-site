# Docusaurus at 40+ versions: build time, memory and snapshot options

Parent: [map](../map.md)
Type: research
Status: resolved
Assignee: tharinduj
Blocked by: 

## Question

Docusaurus advises fewer than 10 versions per docs instance; API Manager alone has 13 and the site would carry more than 25,000 pages. What are the documented limits and known reports on build time and memory for many versions, and which approaches exist to keep builds bounded: one build with all versions, building frozen versions once and serving their static output beside the live site, splitting into several Docusaurus sites, or lazy/partial builds? Include how each affects shared navigation, search and the version selector, and the current site's measured build (15 to 50 minutes, 8 GB heap).

## Answer

2026-10-09. Full findings: [research/04-docusaurus-at-scale.md](../research/04-docusaurus-at-scale.md).

- "Keep fewer than 10 versions" is advice, not a cap; Docusaurus, Jest and React Native archive older versions as links to frozen earlier builds rather than rebuilding them.
- Cost scales with total pages and there is no incremental SSG: about 9,700 files needed about 22 GB RSS even with Docusaurus Faster (Camunda). At 25,000+ pages (about 4x today's 15 to 50 minutes on an 8 GB heap), one build with every version is not viable on standard runners.
- Recommended shape: build Latest plus a small window live; build each frozen version once into static output served under the same URL scheme; list archived versions in the selector as non-SPA links (`pathname://` or absolute).
- Trade-offs: snapshots keep the navigation of the day they were built, need custom search facets, and are link-checked once at snapshot time, not by the live build. Splitting into several sites has similar gaps; partial builds only help dev and previews.
- First step for issue 07: re-test Docusaurus Faster (currently disabled) and measure one frozen version build to size snapshot batches.
