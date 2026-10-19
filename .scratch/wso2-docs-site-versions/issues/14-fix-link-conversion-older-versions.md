# Fix link conversion for older versions

Parent: [map](../map.md)
Type: task (AFK)
Status: open
Assignee:
Blocked by: 10

## Question

The pilot's snapshot builds found 62 to 216 broken internal links per older version. They are recorded as per-version baselines in `docs-site/link-baselines/`, and the gate fails only on new ones. The causes are:

- MkDocs `redirect_maps` not ported, so links to old page names break.
- Route-prefixed external URLs.
- Unrendered `{{base_path}}`.
- `.md/` links left as written.
- `&quot;` inside hrefs.
- Links broken in the sources themselves.

Fix the converter-side causes, port `redirect_maps` as client or static redirects, and shrink each baseline. Report what remains as source defects for the product teams. Details and counts are in the [Task 10 report of Build the pilot](10-build-the-pilot.md).

Also from the pilot: 69 links on IS 6.x snapshot pages point to missing Latest pages through a shared include that uses one `../` too many; the per-snapshot gate cannot see these because it checks only links inside the version route. A re-pin that introduces new source breakage fails the snapshot build until the baseline is re-recorded (`snapshots.mjs build <id> --record-baseline`).

## Rollout findings (2026-10-11)

The rollout's merged gate (Task 4 of the rollout plan) re-recorded 484 new broken links into `link-baselines/live.json`. A review classified them, with evidence, in `.superpowers/sdd/2026-10-11-rollout-all-products/task-4-review.md`. About 140 are converter-caused and are baselined only until this ticket lands:

| Cause | Links | Where the fix belongs |
|---|---|---|
| Root-relative former-site paths `/en/<ver>/...` (86 assets, 18 pages; API Manager 4.5.0 and 4.6.0). The targets exist. | 102 (+2 missing in source) | `packages/docs-converter/src/links.ts:31-32` handles only `https?://`. Assets also need `hosts()` in `scripts/build-content.mjs` and asset copying in `site.ts`. |
| `{{base_path}}` holding only a host (Kubernetes Gateway) | 1 | `site.ts` base_path rendering |
| A `README.md` that MkDocs treats as a folder index is published as a `README/` page | 5 | routing |
| Cross-component `.md` links into `next/` trees the site does not host (written out as `.../x.md/`) | 30 | link fallback |

Source-side, for the product teams:
- 130 relative links climb above the version root, mostly on `includes/` fragments.
- 155 root-relative paths lack the `/en/<ver>/` prefix. 137 of their targets exist, so the converter could optionally recover them.
- 16 relative images climb too far.
- 43 are typos or missing pages and anchors.

Also in scope:
- **Snapshot gate:** the per-snapshot gate drops targets outside the version route (`scripts/snapshots.mjs:128`), so 434 of the 435 snapshot breakages bypassed it and landed in `live.json`. A future `--record-live` could absorb snapshot regressions.
- **`includes/` fragments:** they are published as standalone pages, which accounts for 182 of the 484. Excluding them removes that noise.

Any converter fix here changes every snapshot key, so it lands with a full snapshot rebuild (about 2 to 3 hours locally).

After the Task 6 converter fixes (a2150b4):
- A root-relative `/en/<ver>/` link to a version the site does not host now becomes a full former-site URL. 2 API Manager links whose targets are missing in the source now 404 on the former site, and the link check no longer sees them.
- Streaming Integrator's `/4.3.1/`-style root-relative links (no `/en/`) are not handled.
- Full `https://` links to images and files on former sites stay external.

From the home-layout work (Task 7, f0f61b3), still open:
- Identity Server 5.9.0 to 6.1.0 card homes show `material-icons` names as text ("timer").
- Font Awesome icons inside API Manager 4.0.0 to 4.2.0 tab labels stay invisible.
- Some API Manager overview pages have empty anchors left by unclosed source `<a>` tags.
- An unquoted attribute value containing an apostrophe mis-pairs in `home-layout.ts`. There are no occurrences in the current sources.

From the raw-Markdown fix wave (final fix 2), parked:
- **Gate coverage:** the literal-Markdown gate reads only `<p>`, not `<td>` or `<li>`.
- **Fences:** a code block that contains a fence confuses the fence rule (rule-validator.md, no output change).
- **CommonMark fallback:** a list-item block indented 4 or more still renders as code (24 blocks, pre-existing).
- **Link-target joining:** it could swallow a heading or list line (latent).
- **`unwrap`:** it misses a `</html>` that ends an inner block.
- **Left-as-written blocks:** they keep `class=`.
- **`unsafeUrl`:** it over-rejects `java script:`.
