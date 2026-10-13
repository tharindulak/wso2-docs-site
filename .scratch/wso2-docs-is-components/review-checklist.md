# Review checklist: content components on Identity Platform

For [Docs team reviews the rendered pages](issues/09-docs-team-review.md). Prepared 2026-10-14 from the Identity Platform preview built at `docs-is-migrate` commit `c87d228`.

## What changed and why

The new docs site recognises four writing conventions that Identity Platform pages already follow, and renders them as components. Writers change nothing: the Markdown stays as it is, and MkDocs preview is unaffected.

| Component | Writers already write | The site now shows | Pages (Latest) |
|---|---|---|---|
| Stepper | `## Step 1: …`, `## Step 2: …` | Numbered circles joined by a line | 61 |
| Prerequisites panel | `## Prerequisites`, `## Before you begin`, or a `:::note[Before you begin]` admonition | A boxed panel with a ✓ | 175 |
| Linked tabs | Tab sets with the same labels (npm / yarn / pnpm, Windows / Linux) | Picking a tab switches every matching tab set, and the choice is remembered | 382 pages across all versions |
| Link cards | A "What's next?", "Next steps" or "See also" section that is a list of links | Cards with a short description | 26 |

Each component except linked tabs has a front-matter switch to turn it off for one page: `stepper: false`, `prerequisites: false`, `link_cards: false`.

## How to open the pages

The preview runs locally at `http://127.0.0.1:3000` (`node scripts/serve.mjs site/build-preview --port 3000` in `docs-site/` of the `docs-is-migrate` worktree). Reviewers outside this machine need it served somewhere they can reach, or a screen share; that is the map owner's call. Prefix each path below with the preview address.

## Stepper

| Page | What to check |
|---|---|
| `/identity/connectors/password-reset-enforcer/set-up/` | A plain five-step procedure: circles, line, headings without the "Step N:" text |
| `/identity/guides/flows/flow-extension-configuration/` | Headings written `Step 1 – …` (en dash) |
| `/identity/references/tutorials/connect-with-mattr/` | Steps with `Step 1.1` sub-steps inside them |
| `/identity/guides/authorization/user-impersonation/via-console/` | Three separate step runs on one page |
| `/identity/deploy/deploy-is-on-kubernetes/` | A long procedure with code blocks |

- [ ] The circles show the right numbers, including where the author skips a number
- [ ] The right-hand "On this page" list still shows "Step 1: …" (by design); acceptable?
- [ ] Mobile width: circles and text do not overlap

## Prerequisites panel

| Page | What to check |
|---|---|
| `/identity/guides/authentication/mfa/add-push-auth-login/` | Heading form, five bullets |
| `/identity/guides/authentication/configure-jwt-bearer-grant/` | Admonition form ("Before you begin") becomes the same panel |
| `/identity/guides/users/sync-user-accounts/sync-with-hubspot/` | Admonition titled "Before you begin!" |
| `/identity/guides/account-configurations/login-security/sift-fraud-detection/` | Two panels on one page |
| `/identity/connectors/onfido/set-up/` | Panel directly followed by a stepper |
| `/identity/deploy/get-started/install/` | A long block with sub-headings and notes inside |
| `/identity/get-started/try-your-own-app/react-native-cli-app-auth/` | Tabs inside the panel |

- [ ] The panel reads as "things to have ready", not as a warning
- [ ] A former warning-type admonition losing its warning colour is acceptable
- [ ] Long panels (the install page) are still easy to read

## Linked tabs

| Page | What to check |
|---|---|
| `/identity/sdks/react/overview/` then `/identity/sdks/nextjs/overview/` | Pick pnpm on the first page; the second page opens on pnpm |
| `/identity/references/extend/authentication/write-a-custom-local-authenticator/` | Visual Editor / Classic Editor tabs switch together on the page |
| `/identity/references/tutorials/protect-apps-with-identity-gateway/protect-apps-with-oauth2proxy/` | Windows / Linux tabs |
| `/identity/deploy/security/keystores/create-new-keystores/` | JKS / PKCS12 tabs |

- [ ] Remembering the reader's choice across pages is wanted (it was the MkDocs behaviour)
- [ ] No tab set switches when it should not

## Link cards

| Page | What to check |
|---|---|
| `/identity/guides/verifiable-credentials/oid4vci/` | "See also": the author's own descriptions |
| `/identity/guides/authentication/login-flow-builder/` | "What's next?": descriptions taken from each linked page, cut at three lines |
| `/identity/guides/applications/register-mobile-app/` | A single card |
| `/identity/guides/users/` | An intro sentence above the cards |
| `/identity/deploy/security/keystores/` | "Next steps" written as a procedure stays as written |

- [ ] Descriptions taken from linked pages read well enough; if not, those pages need a `description` in front matter (about 97 linked pages, writers' work)
- [ ] Sections that stay as written (about half) look fine next to pages with cards

## Feedback

Record on [Docs team reviews the rendered pages](issues/09-docs-team-review.md): who reviewed, the date, and each requested change (each becomes its own ticket on the map).
