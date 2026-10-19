# Finish the pilot sign-off

Parent: [map](../map.md)
Type: task (HITL)
Status: open
Assignee:
Blocked by:

## Question

What remains before the pilot counts as fully signed off, now that [Build the pilot](10-build-the-pilot.md) is built but not merged or pushed? Checklist for the user:

- **Faster:** approve or decline adding `@docusaurus/faster`; if approved, measure the live build at `live_window: 2` with Faster and re-apply the 60 min / 14 GB rule.
- **Fork release (criterion 6, live half):** publish a `v4.4.0.1` GA release on a fork of `wso2/docs-mi`, run the bump against the fork (`DOCS_SITE_TEST_OWNER`), and check that only the MI 4.4.0 snapshot key changes.
- **First CI run** once the repo has a GitHub remote: snapshot workflow and PR CI, runner RAM (private repos get 7 GB standard runners), about 18 GB disk.
- **CI hardening (re-review N1):** move the snapshot upload, which holds the write token, to a separate job from the token-free build, before Docusaurus-kind sources are snapshotted.
- **Snapshot key gap:** `site/account/`, `site/account-sidebars.js` and `site/static/` feed snapshot builds but are not in the key.
- **Former-site links:** live pages keep links to older-version former sites external; they break silently when the former sites retire.

## From the rollout's final review (2026-10-11)

These are parked for sign-off; details are in `.superpowers/sdd/2026-10-11-rollout-all-products/final-review.md`.
- `scripts/snapshots.mjs` decides what is tarred but is outside the snapshot key. That is deliberate, because assemble-time redirects live there; a change to its tar logic needs a manual key bump.
- **Cross-leg artifact poisoning in the snapshot workflow:** build code in one leg could upload an artifact named for another leg's key, if it got the runner's artifact token. That token is not in the step env. The consumer checks the tarball contents only partly.
- **Docusaurus Faster and a two-version live window:** not measured. The machine was swapping, and the experiment is saved as a patch in the session scratchpad. Re-test it on a quiet machine or in CI.
- **Broken in-page anchors** (for example `/updates/updates/...`): the live build warns about them, and the link gate does not check anchors.
