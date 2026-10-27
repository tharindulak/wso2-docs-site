#!/usr/bin/env bash
# One-time settings for a content repo that publishes docs bundles (docs-site/DOCS-BUNDLES.md, "Onboarding a repo").
# Run by a docs-site owner with admin rights on the repo. Prints what it would change; --apply changes it.
# Idempotent: rulesets are matched by name and updated in place.
#
#   docs-site/scripts/setup-content-repo.sh <owner/repo> [--apply]
set -euo pipefail

repo=${1:-}
apply=false
[[ ${2:-} == --apply ]] && apply=true
[[ $repo =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "usage: $0 <owner/repo> [--apply]" >&2; exit 2; }
if ! command -v gh >/dev/null || ! command -v jq >/dev/null; then echo "needs gh and jq" >&2; exit 2; fi

say() { printf '%s %s\n' "$($apply && echo '+' || echo '(dry run)')" "$*"; }
api() { if $apply; then gh api "$@" >/dev/null; fi; }

owner_type=$(gh api "repos/$repo" --jq '.owner.type')
visibility=$(gh api "repos/$repo" --jq '.visibility')
echo "$repo: $owner_type-owned, $visibility"
[[ $visibility == public ]] || echo "warning: private repos need GitHub Enterprise Cloud for artifact attestations"

# 1. Immutable releases: a published bundle's asset and tag can never change.
say "enable immutable releases"
api -X PUT "repos/$repo/immutable-releases"

# 2. Release branches: changes only through a reviewed pull request with the bundle check green; no force pushes.
#    Code owner review makes a docs-site owner's approval required (CODEOWNERS: * @<docs-site owners>).
review_rules=$(jq -n '{
  name: "docs release branches: review", target: "branch", enforcement: "active",
  conditions: { ref_name: { include: ["refs/heads/release/**/*"], exclude: [] } },
  bypass_actors: [],
  rules: [
    { type: "pull_request", parameters: {
        required_approving_review_count: 1, require_code_owner_review: true, dismiss_stale_reviews_on_push: true,
        require_last_push_approval: true, required_review_thread_resolution: false, allowed_merge_methods: ["squash", "merge"] } },
    { type: "required_status_checks", parameters: {
        strict_required_status_checks_policy: false, do_not_enforce_on_create: true,
        required_status_checks: [ { context: "bundle / check" } ] } },
    { type: "non_fast_forward" }
  ] }')

# 3. Only repo admins (docs-site owners) create or delete release branches: CODEOWNERS is read from the base branch,
#    so a team that could create one could also name itself as its reviewer.
create_rules=$(jq -n '{
  name: "docs release branches: create and delete", target: "branch", enforcement: "active",
  conditions: { ref_name: { include: ["refs/heads/release/**/*"], exclude: [] } },
  bypass_actors: [ { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" } ],
  rules: [ { type: "creation" }, { type: "deletion" } ] }')

upsert() { # name json
  local id
  id=$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name == \"$1\") | .id" | head -1)
  if [[ -n $id ]]; then say "update ruleset \"$1\" ($id)"; api -X PUT "repos/$repo/rulesets/$id" --input - <<<"$2"
  else say "create ruleset \"$1\""; api -X POST "repos/$repo/rulesets" --input - <<<"$2"; fi
}
upsert "docs release branches: review" "$review_rules"
upsert "docs release branches: create and delete" "$create_rules"

# 4. Tag ruleset: only in an organization, where GitHub Actions can be the bypass actor. On user-owned repos a tag
#    ruleset would block the release workflow too; intake's attestation check is the gate there.
if [[ $owner_type == Organization ]]; then
  tag_rules=$(jq -n '{
    name: "docs release tags", target: "tag", enforcement: "active",
    conditions: { ref_name: { include: ["refs/tags/v*", "refs/tags/*/v*"], exclude: [] } },
    bypass_actors: [ { actor_id: 15368, actor_type: "Integration", bypass_mode: "always" } ],
    rules: [ { type: "creation" }, { type: "update" }, { type: "deletion" } ] }')
  upsert "docs release tags" "$tag_rules"
else
  echo "skip: tag ruleset (user-owned repo: GitHub Actions cannot bypass it)"
fi

# 5. Checks a script cannot fix: report them for the checklist.
admins=$(gh api "repos/$repo/collaborators?affiliation=direct&per_page=100" --paginate --jq '.[] | select(.permissions.admin) | .login' 2>/dev/null || true)
[[ -n $admins ]] && echo "check: direct admins (product teams must hold write, not admin): $(echo "$admins" | tr '\n' ' ')"
for f in .github/CODEOWNERS CODEOWNERS docs/CODEOWNERS; do
  gh api "repos/$repo/contents/$f" >/dev/null 2>&1 && { echo "found $f: make sure it names the docs-site owners for *"; break; }
done || true
gh api "repos/$repo/contents/.github/workflows/docs-bundle.yml" >/dev/null 2>&1 \
  && echo "found .github/workflows/docs-bundle.yml" || echo "missing: .github/workflows/docs-bundle.yml (the caller; see DOCS-BUNDLES.md)"
$apply || echo "dry run: nothing changed; rerun with --apply"
