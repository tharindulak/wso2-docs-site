# Docs VM hosting kit

What the Deploy and Preview workflows need on the VM that serves the docs site: Typesense, the deploy user's folders, a gate that is the only thing the control keys may run, and the deploy keys. Decided on the [delivery map](../../.scratch/wso2-docs-site-delivery/map.md) (Deploy workflow spec, Preview workflow spec, Hosting config). The web server is not part of this kit.

| File | Installed as | |
|---|---|---|
| `docs-gate` | `/usr/local/sbin/docs-gate` (root, 755) | Forced command for the two gate keys. Verbs, whole-string allow-listed: site `current`, `switch <id>`, `rollback`, `prune`; preview `preview-plan <name>`, `preview-switch <name> <id>`, `preview-delete <name>`, `preview-clean`. Prints `key=value` lines. |
| `typesense/compose.yaml` | `/opt/docs-site/typesense/compose.yaml` | Typesense 30.2 (pinned digest, amd64 and arm64) on `127.0.0.1:8108`, 8 GB memory limit. |
| `setup.sh` | run from a copy of this folder | `apply` installs or updates everything, `check` reports drift. Safe to run again. |

## Layout on the VM

```
/srv/docs/releases/<id>/                  site releases; the site upload key writes here (rrsync, write-only, no deletes)
/srv/docs/current -> releases/<id>        what the web server serves; only the gate changes it
/srv/docs/previews/builds/<name>_<id>/    preview builds; the preview upload key writes here
/srv/docs/previews/live/<name> -> ../builds/<name>_<id>   what the web server serves for preview <name>
/etc/docs-site/gate.conf                  gate settings (root)
/etc/docs-site/typesense.env              Typesense admin and search keys (root:deploy 640), made on the VM, never copied off it
/etc/ssh/authorized_keys/deploy           the four deploy keys with their forced commands (root)
```

`<id>` is `<UTC timestamp>-<short sha>`, for example `20261020T091500Z-abc1234`. A release or preview build is switchable only when it holds `.release.json` (with its own id) and, written last, `.release-complete`. The web server must not publish dot files or `_search/`.

## Keys

Four ed25519 keys, private halves only in GitHub environment secrets, public halves passed to `setup.sh apply --keys <dir>` as `site-upload.pub`, `site-gate.pub`, `preview-upload.pub`, `preview-gate.pub`. The upload keys run `rrsync -wo -no-del -munge` into their folder and nothing else; the gate keys run `docs-gate site` or `docs-gate preview`. A build job (which runs content code) only ever holds an upload key.

## Search

On `switch <id>` the gate creates collection `docs_<id>` from the release's `_search/schema.json`, imports `_search/records.jsonl`, makes sure the search-only key and analytics rules exist, writes `search-config.json` into the release (when `--search-url` was given), moves the `docs` alias, then switches `current`. A failed import or alias move leaves the live site and index as they were. `rollback` moves both back; `prune` keeps three complete releases plus the live one, and only their collections.

## Run

```sh
rsync -r docs-site/hosting/ <admin>@<vm>:docs-hosting/      # plus a folder with the four .pub files
ssh <admin>@<vm> 'sudo docs-hosting/setup.sh apply --keys docs-keys --search-url https://search.<host> --cors-origin https://<host>'
ssh <admin>@<vm> 'sudo docs-hosting/setup.sh check'
```

Tests: `scripts/test/docs-gate.test.mjs` runs the gate against a temporary folder and a stand-in Typesense (Linux only; skipped elsewhere).
