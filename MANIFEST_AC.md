# Manifest-Based Visual Comparison — Acceptance Criteria

This document is the authoritative acceptance criteria for the `manifest-generate`, `manifest-compare`, and `manifest-merge` workflow modes described in `MANIFEST_PLAN.md`. It is intended for use during PR review to verify the implementation satisfies every behavioral requirement.

---

## 1. `manifest-generate` mode

### 1.1 Normal run — differential upload

**Given** the `workflow` input is `manifest-generate`, a HEAD manifest exists at `manifests/{head-sha}.json` in S3, and `visual-test-command` completes successfully  
**When** the action runs  
**Then**:

- The MD5 hash of each `new.png` in the screenshots directory is computed using Node.js `crypto` from the full-size image on disk
- Each entry is keyed by the screenshot directory's path relative to the screenshots root (prefixed with package path for monorepos)
- Only images whose hash differs from the HEAD manifest are uploaded to `new-images/{commit-sha}/path/new.png`
- If resize is enabled: changed images are resized before upload
- If resize is not enabled: changed images are uploaded full-size
- Images whose hash matches the HEAD manifest are not uploaded
- Nothing is ever written to `original-new-images/`
- A manifest is written to `manifests/{commit-sha}.json` mapping every screenshot directory path to its MD5 hash (all screenshots, not just changed ones)

### 1.2 First run — no HEAD manifest exists

**Given** the `workflow` input is `manifest-generate` and no manifest exists at `manifests/{head-sha}.json` in S3  
**When** the action runs  
**Then**:

- The missing manifest is treated as an empty object (no hash comparisons are performed)
- All images are uploaded to `new-images/{commit-sha}/path/new.png` following the same resize rules as 1.1
- A manifest is written to `manifests/{commit-sha}.json` for all screenshots

### 1.3 Hashing is always from full-size image

**Given** any run of `manifest-generate`  
**When** hashes are computed  
**Then** each MD5 hash is computed from the full-size image file as it exists on disk after `visual-test-command` completes — before any resize is applied

### 1.4 Monorepo — per-package manifest path

**Given** the `workflow` input is `manifest-generate` and `package-paths` is non-empty  
**When** the manifest is written to S3  
**Then** the manifest is uploaded to `manifests/{commit-sha}/{package-path}.json` (one file per package invocation) instead of `manifests/{commit-sha}.json`

---

## 2. `manifest-compare` mode

### 2.1 All hashes match — success

**Given** the `workflow` input is `manifest-compare`, the PR manifest at `manifests/{pr-head-sha}.json` and the HEAD manifest at `manifests/{head-sha}.json` both exist, and every hash in the PR manifest matches the corresponding hash in the HEAD manifest  
**When** the action runs  
**Then**:

- A success commit status is set on the PR head SHA
- No changeset is written
- No Comparadise comment is posted

### 2.2 PR Owns — PR introduced a visual diff (normal case)

**Given** at least one hash differs between the PR manifest and the HEAD manifest, and for a given differing path the HEAD hash equals the ancestor hash (PR introduced the change)  
**When** the 3-way comparison runs for that path  
**Then**:

- `base.png` is downloaded from `base-images/path/base.png`
- `new.png` is downloaded from `new-images/{pr-sha}/path/new.png` (as uploaded by `manifest-generate`)
- A `diff.png` is generated via pixelmatch
- `base.png` and `diff.png` are uploaded to `new-images/{pr-sha}/path/base.png` and `new-images/{pr-sha}/path/diff.png`; if resize is enabled they are resized before upload

### 2.3 PR Owns — new screenshot (not in HEAD or ancestor)

**Given** a path exists in the PR manifest but does not exist in either the HEAD manifest or the ancestor manifest  
**When** the 3-way comparison runs for that path  
**Then**:

- No `base.png` is downloaded
- No `diff.png` is generated or uploaded
- Only `new.png` is referenced (already uploaded by `manifest-generate`)
- The path is treated as a PR-owned change (contributes to pending status and Comparadise comment)

### 2.4 PR Owns — deleted screenshot (PR deleted, HEAD = ancestor)

**Given** a path exists in the ancestor manifest and the HEAD manifest with the same hash, but does not exist in the PR manifest  
**When** the 3-way comparison runs for that path  
**Then**:

- The deletion is logged as an informational message
- The path is recorded as a `null` entry in the changeset
- The path does not contribute to pending status or Comparadise comment

### 2.5 Main Owns — main changed, PR is clean

**Given** for a given differing path the PR hash equals the ancestor hash (main introduced the change, not the PR)  
**When** the 3-way comparison runs for that path  
**Then**:

- No diff is generated for that path
- The path is not included in the changeset
- This path alone does not cause a pending or failure status

### 2.6 Main Owns — screenshot added on main since branching

**Given** a path exists in the HEAD manifest but not in the PR manifest or the ancestor manifest  
**When** the 3-way comparison runs for that path  
**Then**:

- The path is treated as Main Owns (main added it, PR didn't touch it)
- No diff is generated, no failure or pending status is set for this path alone

### 2.7 Conflict — all three hashes differ

**Given** for a given path the PR hash, HEAD hash, and ancestor hash are all different  
**When** the 3-way comparison runs for that path  
**Then** the path is collected as a conflict

### 2.8 Outcome: any conflict → failure

**Given** at least one path was collected as a conflict  
**When** the outcome is determined  
**Then**:

- A failure commit status is set on the PR head SHA
- A comment is posted listing the conflicting paths with a rebase instruction
- No changeset is written

### 2.10 Outcome: all Main Owns (no PR Owns, no conflicts) → success

**Given** all differing hashes are Main Owns (no PR Owns, no conflicts)  
**When** the outcome is determined  
**Then** a success commit status is set on the PR head SHA

### 2.11 Outcome: at least one PR Owns, no conflicts → pending

**Given** at least one path is PR Owns and no paths are conflicts  
**When** the outcome is determined  
**Then**:

- A pending commit status is set on the PR head SHA
- A Comparadise comment is posted
- A changeset is written to `changesets/{pr-head-sha}.json`

### 2.12 Changeset schema

**Given** a changeset is written  
**Then**:

- The file is at `changesets/{pr-head-sha}.json`
- It contains `_headSha`: the HEAD SHA resolved in step 2 of the compare flow
- It contains one entry per PR-owned changed path with the PR's new hash as the value
- It contains one entry per PR-deleted path with `null` as the value
- Main Owns paths are not included
- The changeset contains only paths where the PR introduced a change

### 2.13 Missing ancestor manifest

**Given** the ancestor SHA is resolved but `manifests/{ancestor-sha}.json` does not exist in S3  
**When** the compare runs  
**Then**:

- The action fails
- An error message is returned explaining that the ancestor manifest was not found and instructing the user to ensure `manifest-generate` has run on the base branch and to rebase onto a commit that has a manifest

### 2.14 HEAD SHA resolution

**Given** the compare mode runs  
**When** the HEAD SHA is resolved  
**Then** the GitHub API is called at `GET /repos/{owner}/{repo}/branches/{base.ref}` to get the latest main HEAD SHA (not a stale cached value)

### 2.15 Ancestor SHA resolution

**Given** the HEAD SHA and PR SHA are known  
**When** the ancestor SHA is resolved  
**Then** the GitHub Compare API is called at `GET /repos/{owner}/{repo}/compare/{head-sha}...{pr-sha}` and `merge_base_commit.sha` is used as the ancestor SHA

### 2.16 Monorepo — squash per-package manifests before comparison

**Given** the `workflow` input is `manifest-compare` and `package-paths` is non-empty  
**When** the action resolves the PR manifest  
**Then**:

- All per-package manifests at `manifests/{pr-sha}/{package-path}.json` are downloaded and merged into a single manifest
- The squashed manifest is uploaded to `manifests/{pr-sha}.json`
- The squashed manifest is used alongside the pre-existing `manifests/{head-sha}.json` and `manifests/{ancestor-sha}.json` for the 3-way comparison

---

## 3. `manifest-merge` mode

### 3.1 Manifest always written for merge commit

**Given** the `workflow` input is `manifest-merge`  
**When** the action runs  
**Then** a manifest is always written to `manifests/{merge-commit-sha}.json`, regardless of whether a changeset exists

### 3.2 No changeset — copy parent manifest

**Given** no changeset exists at `changesets/{pr-head-sha}.json`  
**When** the action runs  
**Then**:

- The parent manifest (`manifests/{parent-sha}.json`) is copied as-is to `manifests/{merge-commit-sha}.json`
- No base images are updated
- No failure status is set

### 3.3 Conflict prevention — overlapping open PR changesets

**Given** a changeset exists for the merging PR, and at least one other open PR has a changeset that shares at least one screenshot path key with the merging PR's changeset  
**When** the merge action runs  
**Then**:

- A failure commit status is set on that other open PR's head SHA
- The failure status message indicates visual comparison is outdated and a rebase is required
- This check is performed for every open PR that has a changeset in S3

### 3.4 Stale changeset — no overlapping paths → proceed

**Given** the changeset's `_headSha` does not match the merge commit's first parent SHA, but none of the changeset's screenshot keys differ between `manifests/{changeset._headSha}.json` and `manifests/{parents[0].sha}.json`  
**When** the merge action runs  
**Then** the merge proceeds normally (the intervening merges didn't touch the same screenshots)

### 3.5 Stale changeset — overlapping paths → fail

**Given** the changeset's `_headSha` does not match the merge commit's first parent SHA, and at least one changeset key has a different hash in `manifests/{changeset._headSha}.json` vs `manifests/{parents[0].sha}.json`  
**When** the merge action runs  
**Then**:

- The action fails
- The conflicting paths are listed in the failure output

### 3.6 Overlay — non-null entries update hash

**Given** a valid (non-stale) changeset exists  
**When** the changeset is overlaid onto the parent manifest  
**Then** for each non-null entry in the changeset, the corresponding key in the resulting manifest has the changeset's hash value

### 3.7 Overlay — null entries remove key

**Given** a valid changeset contains a `null` entry for a path  
**When** the changeset is overlaid onto the parent manifest  
**Then** that path is absent from `manifests/{merge-commit-sha}.json`

### 3.8 Base image update — non-null entries

**Given** a valid changeset is applied  
**When** base images are updated  
**Then** for each non-null changeset entry, `new-images/{pr-sha}/path/new.png` is copied to `base-images/path/base.png`

### 3.9 Base image update — null entries delete base image

**Given** a valid changeset contains a `null` entry for a path  
**When** base images are updated  
**Then** `base-images/path/base.png` is deleted from S3

### 3.10 Parent SHA resolution

**Given** the merge commit SHA is known  
**When** the parent manifest is fetched  
**Then** the GitHub API is called to get `parents[0].sha` of the merge commit, and `manifests/{parents[0].sha}.json` is used as the parent manifest

---

## 4. General / Cross-cutting

### 4.1 New modes do not affect existing modes

**Given** the `workflow` input is `pr` or `merge`  
**When** the action runs  
**Then** behavior is identical to before this implementation — no regressions in existing modes

### 4.2 Manifest key format — monorepo

**Given** the action is run in a monorepo with a non-empty `package-paths` input  
**When** manifest entries are keyed  
**Then** each key is prefixed with the package path (e.g. `packages/ui/components/Button`, not just `components/Button`)

### 4.3 Manifest key format — single package

**Given** no `package-paths` input is set  
**When** manifest entries are keyed  
**Then** each key is the screenshot directory's path relative to the screenshots root (no prefix)

### 4.4 S3 key structure is exact

**Given** the implementation writes or reads any manifest, changeset, or image  
**Then** the following exact S3 key patterns are used:

- Manifests (single-package, or squashed by compare for monorepo): `manifests/{commit-sha}.json`
- Manifests (monorepo, written by generate per package): `manifests/{commit-sha}/{package-path}.json`
- Changesets: `changesets/{pr-head-sha}.json`
- New images: `new-images/{commit-sha}/path/new.png` (resized if resize is enabled, full-size otherwise)
- Base images: `base-images/path/base.png` (same dimensions as `new-images/` — resized if resize is enabled)
- `original-new-images/` is never written by any manifest mode

### 4.5 MD5 hashing implementation

**Given** a screenshot file is hashed  
**Then** Node.js `crypto` is used to compute the MD5 hash of the full-size image file

### 4.6 Concurrency constraint is documented

**Given** the implementation is complete  
**Then** the documentation (README, `action.yml` input descriptions, or equivalent) explicitly states that consumers using `manifest-merge` must configure a `concurrency` group with `cancel-in-progress: false` on their merge workflow to prevent concurrent merge races

### 4.7 `action/dist/` is rebuilt and committed

**Given** any file in `action/src/` is changed  
**Then** `bunx nx build action` has been run and the updated `action/dist/` files are included in the PR
