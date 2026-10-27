# Deploy release record and rollback

Parent: [map](../map.md)
Type: grilling (HITL)
Status: open
Assignee:
Blocked by: 06

## Question

Specify the GitHub Release the Deploy workflow creates on the docs-site repo for each deploy (tag, contents: site commit, every section's bundle and digest, snapshot keys, VM release id), and the two rollbacks: one section back to its previous bundle (a lock PR, and whether it auto-merges), and the whole site back to a previous deploy (dispatch with that release, reusing the VM's release folders). Target the 141 VM only.

Input from [Content-repo release flow](04-content-repo-release-flow.md): a deleted release means withdrawn; intake pins the section's previous bundle.

Inputs from [Docs-site intake spec](06-docs-site-intake-spec.md): section rollback for a withdrawn release is an auto-merging lock PR to the previous bundle (case d); every version entry records `tag`, `bundle.sha256` and `source_commit`, which the deploy record can list.
