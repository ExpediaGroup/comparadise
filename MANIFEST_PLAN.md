# Manifest-Based Visual Comparison — Implementation Plan

## Architecture Summary

Three new workflow modes added to the existing action:

| Mode                | Trigger                        | Purpose                                                       |
| ------------------- | ------------------------------ | ------------------------------------------------------------- |
| `manifest-generate` | PR push                        | Run tests, hash screenshots, upload images + manifest to S3   |
| `manifest-compare`  | PR (after generate)            | 3-way hash comparison, diff generation, GitHub status/comment |
| `manifest-merge`    | `pull_request` closed (merged) | Overlay changeset onto HEAD manifest, update base images      |

## S3 Structure (new)

```
bucket/
├── manifests/{commit-sha}.json              # Full manifest: { "pkg/path/component-dir": "md5hash", ... }
├── changesets/{pr-head-sha}.json            # Changeset: { "pkg/path/component-dir": "newhash", "pkg/path/other-dir": null }
├── base-images/[path]/base.png              # (existing) Updated by manifest-merge
├── new-images/{sha}/[path]/new.png          # (existing) Only changed images uploaded per commit
└── original-new-images/{sha}/[path]/new.png # (existing) Full-size originals if resize enabled
```

## File Schemas

### Manifest (`manifests/{commit-sha}.json`)

```json
{
  "components/Button": "d41d8cd98f00b204e9800998ecf8427e",
  "components/Modal": "7d793037a076d2e1f3eb15d3a5e4389a",
  "pages/Home": "098f6bcd4621d373cade4e832627b4f6"
}
```

A flat object mapping each screenshot directory's relative path (prefixed with package path for monorepos) to an MD5 hash derived from the image(s) in that directory.

### Changeset (`changesets/{pr-head-sha}.json`)

```json
{
  "_headSha": "abc123def456...",
  "components/Button": "a3c2f8d1b4e6a9c7d2f0e1b3a5c7d9f1",
  "components/Removed": null
}
```

A flat object containing only entries the PR changed. Non-null values are the PR's new hash. `null` indicates the screenshot was deleted by the PR. `_headSha` records the main HEAD SHA that `manifest-compare` resolved when the changeset was written — used by `manifest-merge` to detect stale changesets.

## Flow Details

### `manifest-generate` mode

1. Run `visual-test-command` (no base image download, no diff expected)
2. Walk screenshots directory, compute MD5 hash for each screenshot directory (keyed by the directory's path relative to the screenshots root)
3. Fetch the HEAD manifest from S3 to determine which hashes changed (if no manifest exists, treat as empty — all images upload)
4. Upload only changed images to `new-images/{commit-sha}/path/new.png`
5. If resize enabled: upload resized to `new-images/`, upload full-size original to `original-new-images/`
6. Upload manifest to `manifests/{commit-sha}.json`

### `manifest-compare` mode

1. Fetch PR's manifest from `manifests/{pr-head-sha}.json`
2. Resolve latest main HEAD via GitHub API (`GET /repos/{owner}/{repo}/branches/{base.ref}`)
3. Fetch HEAD's manifest from `manifests/{head-sha}.json`
4. Compare hashes:
   - **All match** → set success status, done
   - **At least one differs** → proceed to 3-way comparison
5. Resolve ancestor SHA via GitHub Compare API (`GET /repos/{owner}/{repo}/compare/{head-sha}...{pr-sha}` → `merge_base_commit.sha`)
6. Fetch ancestor manifest from `manifests/{ancestor-sha}.json` (fail with rebase instruction if missing)
7. For each differing directory, run 3-way comparison (treat missing entries as a distinct state):
   - **PR Owns (HEAD = ancestor):** PR introduced the diff → download base.png from `base-images/`, download PR's new.png from `new-images/{pr-sha}/path/new.png`, generate diff.png via pixelmatch, upload base.png and diff.png to `new-images/{pr-sha}/path/{base,diff}.png`
     - Special case: new screenshot (not in HEAD or ancestor) → no base.png or diff.png, just new.png
     - Special case: PR deletes screenshot (not in PR, HEAD = ancestor) → note deletion, no images to upload
   - **Main Owns (PR = ancestor):** Main changed, PR is clean → pass (log informational message)
     - Includes: screenshot added on main since branching (in HEAD only)
   - **Conflict (all different):** Conflict → collect conflicting paths
8. Determine outcome:
   - All Scenario 2 → success status
   - Any Scenario 1 (and no Scenario 3) → pending status + Comparadise comment
   - Any Scenario 3 → failure status + comment listing conflicts with rebase instruction
9. If no Scenario 3 conflicts, write changeset to `changesets/{pr-head-sha}.json`:
   - `_headSha`: the HEAD SHA resolved in step 2
   - Changed entries (Scenario 1): `"path": "pr-hash"`
   - Deleted entries (in ancestor but not in PR): `"path": null`
   - Scenario 2 entries: not included (HEAD's values are correct)
   - Skip entirely if outcome is failure (Scenario 3)

### `manifest-merge` mode

1. Get PR head SHA from `github.event.pull_request.head.sha`
2. Get merge commit SHA from `github.event.pull_request.merge_commit_sha`
3. Fetch changeset from `changesets/{pr-head-sha}.json` (if missing, treat as no changes)
4. Conflict prevention: if changeset exists, list all open PRs via GitHub API; for each open PR, fetch `changesets/{pr-head-sha}.json` from S3 (skip if missing); for each open PR whose changeset shares at least one screenshot key with this PR's changeset, set a failure commit status on that PR's head SHA (message: "Visual comparison outdated — please rebase")
5. Fetch first parent of merge commit via GitHub API (`parents[0].sha`) → load `manifests/{parent-sha}.json`
6. If no changeset: copy parent manifest as-is to `manifests/{merge-commit-sha}.json`, done
7. Stale changeset check: if `changeset._headSha !== parents[0].sha`:
   - Fetch `manifests/{changeset._headSha}.json` (the manifest HEAD at compare time)
   - For each screenshot key in the changeset (excluding `_headSha`), compare its hash in `manifests/{changeset._headSha}.json` vs `manifests/{parents[0].sha}.json`
   - If any key differs between the two manifests: fail with the list of conflicting paths (conflict prevention in step 4 should have prevented this; treat as a safeguard)
   - If no keys differ: proceed (the intervening merges didn't touch the same screenshots)
8. Overlay changeset onto parent manifest:
   - Non-null entries: update hash
   - Null entries: remove key
9. Write result to `manifests/{merge-commit-sha}.json`
10. Update base images: for each non-null changeset entry, copy `new-images/{pr-sha}/path/new.png` → `base-images/path/base.png`. For null entries, delete `base-images/path/base.png`.

## Design Decisions

- **Coexistence:** New modes alongside existing `pr`/`merge` — consumers opt in
- **Hashing:** MD5 via Node.js `crypto`. Always computed from the full-size image regardless of resize settings
- **Missing ancestor manifest:** Fail with rebase instruction (only during initial adoption)
- **Staleness handling:** Changeset overlay at merge time ensures concurrent merges are handled correctly
- **Merge concurrency:** Consumers **must** set a `concurrency` group (with `cancel-in-progress: false`) on their `manifest-merge` workflow to serialize merge jobs. Without it, two simultaneous merges can both update `base-images/` at the same time, producing a corrupted or interleaved state that `manifest-compare` jobs running in parallel will read. The concrete race: PR A and PR B merge within seconds of each other; both `manifest-merge` jobs start concurrently, each overwriting overlapping `base-images/` keys; a `manifest-compare` job for an open PR C reads `base-images/` mid-update and generates a diff against a partially-applied base, producing a wrong or misleading visual result. Serializing merges via `concurrency` eliminates this window entirely.
- **Stale changeset detection:** The changeset stores `_headSha` (the HEAD SHA at compare time).
  At merge time, open PRs whose changesets overlap with the merging PR's changeset are proactively failed with a "rebase required" commit status — preventing the stale scenario from occurring. If `manifest-merge` nonetheless finds a stale changeset with overlapping paths (e.g. due to a race or the conflict prevention step being skipped), it fails the merge job with the conflicting paths listed as a safeguard. If the stale changeset has no overlapping paths, the merge proceeds normally.

## No Changes To

- Existing `pr` and `merge` workflow modes
- Comparadise web app (uses same `new-images/` structure)
- `comparadise-utils` npm package (for now)
- GitHub Action inputs (only `workflow` gets new valid values)

## Implementation Order

1. Manifest utilities: hashing, reading/writing manifests to S3, changeset computation
2. `manifest-generate` mode
3. `manifest-compare` mode (3-way logic + diff generation)
4. `manifest-merge` mode (overlay + base image updates)
5. Tests for each mode
6. Documentation update
