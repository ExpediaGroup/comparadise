# Manifest-Based Visual Comparison — Acceptance Criteria (Review #1)

This is `MANIFEST_AC.md` annotated with implementation status for PR #786. Source-only review of `action/src/`; local `HEAD` (`022458d`) matches the PR head SHA. Each criterion is marked ✅ (satisfied), ❌ (not satisfied), or ⚠️ (partial / unverifiable), with a reason for anything not satisfied.

---

## 1. `manifest-generate` mode

### 1.1 Normal run — differential upload

**Given** the `workflow` input is `manifest-generate`, a HEAD manifest exists at `manifests/{head-sha}.json` in S3, and `visual-test-command` completes successfully  
**When** the action runs  
**Then**:

- ✅ The MD5 hash of each `new.png` in the screenshots directory is computed using Node.js `crypto` from the full-size image on disk
- ❌ Each entry is keyed by the screenshot directory's path relative to the screenshots root (prefixed with package path for monorepos) — _`manifest-generate.ts:38-43` never reads `package-paths`; keys get no package prefix (see 4.2)_
- ✅ Only images whose hash differs from the HEAD manifest are uploaded to `new-images/{commit-sha}/path/new.png`
- ✅ If resize is enabled: changed images are resized before upload
- ✅ If resize is not enabled: changed images are uploaded full-size
- ✅ Images whose hash matches the HEAD manifest are not uploaded
- ❌ Nothing is ever written to `original-new-images/` — _`manifest-generate.ts:70-74` writes `original-new-images/{commit-sha}/{key}/new.png` when resize is enabled; asserted by `manifest-generate.test.ts:206-237`_
- ✅ A manifest is written to `manifests/{commit-sha}.json` mapping every screenshot directory path to its MD5 hash (all screenshots, not just changed ones)

### 1.2 First run — no HEAD manifest exists

**Given** the `workflow` input is `manifest-generate` and no manifest exists at `manifests/{head-sha}.json` in S3  
**When** the action runs  
**Then**:

- ✅ The missing manifest is treated as an empty object (no hash comparisons are performed) — _`fetchHeadManifest` returns `null` on `NoSuchKey`; filter falls back to "all"_
- ✅ All images are uploaded to `new-images/{commit-sha}/path/new.png` following the same resize rules as 1.1
- ✅ A manifest is written to `manifests/{commit-sha}.json` for all screenshots

### 1.3 Hashing is always from full-size image

**Given** any run of `manifest-generate`  
**When** hashes are computed  
**Then** ✅ each MD5 hash is computed from the full-size image file as it exists on disk after `visual-test-command` completes — before any resize is applied — _`manifest-generate.ts:41` hashes the on-disk file; resize only touches the upload buffer_

### 1.4 Monorepo — per-package manifest path

**Given** the `workflow` input is `manifest-generate` and `package-paths` is non-empty  
**When** the manifest is written to S3  
**Then** ❌ the manifest is uploaded to `manifests/{commit-sha}/{package-path}.json` (one file per package invocation) instead of `manifests/{commit-sha}.json` — _not implemented_

---

## 2. `manifest-compare` mode

### 2.1 All hashes match — success

**Given** the `workflow` input is `manifest-compare`, the PR manifest at `manifests/{pr-head-sha}.json` and the HEAD manifest at `manifests/{head-sha}.json` both exist, and every hash in the PR manifest matches the corresponding hash in the HEAD manifest  
**When** the action runs  
**Then**:

- ✅ A success commit status is set on the PR head SHA
- ✅ No changeset is written
- ✅ No Comparadise comment is posted

_`manifest-compare.ts:56-65`_

### 2.2 PR Owns — PR introduced a visual diff (normal case)

**Given** at least one hash differs between the PR manifest and the HEAD manifest, and for a given differing path the HEAD hash equals the ancestor hash (PR introduced the change)  
**When** the 3-way comparison runs for that path  
**Then**:

- ✅ `base.png` is downloaded from `base-images/path/base.png`
- ✅ `new.png` is downloaded from `new-images/{pr-sha}/path/new.png` (as uploaded by `manifest-generate`)
- ✅ A `diff.png` is generated via pixelmatch
- ✅ `base.png` and `diff.png` are uploaded to `new-images/{pr-sha}/path/base.png` and `new-images/{pr-sha}/path/diff.png`; if resize is enabled they are resized before upload — _`manifest-diff.ts:30-53`; resize satisfied transitively since both source images are already resized in S3_

### 2.3 PR Owns — new screenshot (not in HEAD or ancestor)

**Given** a path exists in the PR manifest but does not exist in either the HEAD manifest or the ancestor manifest  
**When** the 3-way comparison runs for that path  
**Then**:

- ✅ No `base.png` is downloaded
- ✅ No `diff.png` is generated or uploaded
- ✅ Only `new.png` is referenced (already uploaded by `manifest-generate`)
- ✅ The path is treated as a PR-owned change (contributes to pending status and Comparadise comment)

_`manifest-compare-classify.ts:75-76` (`added`); `manifest-diff.ts:23` only diffs `changed`_

### 2.4 PR Owns — deleted screenshot (PR deleted, HEAD = ancestor)

**Given** a path exists in the ancestor manifest and the HEAD manifest with the same hash, but does not exist in the PR manifest  
**When** the 3-way comparison runs for that path  
**Then**:

- ❌ The deletion is logged as an informational message — _no `core.info` is emitted for deletions in `classify`_
- ✅ The path is recorded as a `null` entry in the changeset — _`buildChangeset` (`manifest-compare.ts:145-146`)_
- ❌ The path does not contribute to pending status or Comparadise comment — _deletions go into the same `prOwns` array as reviewable changes (`manifest-compare-classify.ts:79-81`), so a delete-only PR fails the `prOwns.length === 0` gate (`manifest-compare.ts:72`) and is forced to **pending**, and the comment renders `Deleted screenshots: N` (`run.ts:433-441`). The code conflates "PR introduced this change" (correct for the changeset) with "this needs to gate/be shown."_

### 2.5 Main Owns — main changed, PR is clean

**Given** for a given differing path the PR hash equals the ancestor hash (main introduced the change, not the PR)  
**When** the 3-way comparison runs for that path  
**Then**:

- ✅ No diff is generated for that path
- ✅ The path is not included in the changeset
- ✅ This path alone does not cause a pending or failure status

_`manifest-compare-classify.ts:82-84`; `buildChangeset` iterates only `prOwns`_

### 2.6 Main Owns — screenshot added on main since branching

**Given** a path exists in the HEAD manifest but not in the PR manifest or the ancestor manifest  
**When** the 3-way comparison runs for that path  
**Then**:

- ✅ The path is treated as Main Owns (main added it, PR didn't touch it) — _`prHash === ancestorHash === null` → `mainOwns`_
- ✅ No diff is generated, no failure or pending status is set for this path alone

### 2.7 Conflict — all three hashes differ

**Given** for a given path the PR hash, HEAD hash, and ancestor hash are all different  
**When** the 3-way comparison runs for that path  
**Then** ✅ the path is collected as a conflict — _`manifest-compare-classify.ts:85-87`_

### 2.8 Outcome: any conflict → failure

**Given** at least one path was collected as a conflict  
**When** the outcome is determined  
**Then**:

- ✅ A failure commit status is set on the PR head SHA
- ✅ A comment is posted listing the conflicting paths with a rebase instruction
- ✅ No changeset is written

_`manifest-compare.ts:67-70, 88-107`_

### 2.10 Outcome: all Main Owns (no PR Owns, no conflicts) → success

**Given** all differing hashes are Main Owns (no PR Owns, no conflicts)  
**When** the outcome is determined  
**Then** ✅ a success commit status is set on the PR head SHA — _`manifest-compare.ts:72-83`_

### 2.11 Outcome: at least one PR Owns, no conflicts → pending

**Given** at least one path is PR Owns and no paths are conflicts  
**When** the outcome is determined  
**Then**:

- ✅ A pending commit status is set on the PR head SHA
- ✅ A Comparadise comment is posted
- ✅ A changeset is written to `changesets/{pr-head-sha}.json`

_`manifest-compare.ts:109-136`. Note: interacts with the 2.4 defect — a deletion-only PR also lands here instead of being treated as non-contributing._

### 2.12 Changeset schema

**Given** a changeset is written  
**Then**:

- ✅ The file is at `changesets/{pr-head-sha}.json` — _`manifest-s3.ts:39-50`_
- ✅ It contains `_headSha`: the HEAD SHA resolved in step 2 of the compare flow
- ✅ It contains one entry per PR-owned changed path with the PR's new hash as the value
- ✅ It contains one entry per PR-deleted path with `null` as the value
- ✅ Main Owns paths are not included
- ✅ The changeset contains only paths where the PR introduced a change

_`buildChangeset` (`manifest-compare.ts:138-158`)_

### 2.13 Missing ancestor manifest

**Given** the ancestor SHA is resolved but `manifests/{ancestor-sha}.json` does not exist in S3  
**When** the compare runs  
**Then**:

- ✅ The action fails
- ⚠️ An error message is returned explaining that the ancestor manifest was not found and instructing the user to ensure `manifest-generate` has run on the base branch and to rebase onto a commit that has a manifest — _`manifest-compare-classify.ts:143-146` mentions only "rebase your branch"; it omits the "ensure `manifest-generate` ran on the base branch" instruction_

### 2.14 HEAD SHA resolution

**Given** the compare mode runs  
**When** the HEAD SHA is resolved  
**Then** ✅ the GitHub API is called at `GET /repos/{owner}/{repo}/branches/{base.ref}` to get the latest main HEAD SHA (not a stale cached value) — _`resolveHeadSha` → `repos.getBranch`_

### 2.15 Ancestor SHA resolution

**Given** the HEAD SHA and PR SHA are known  
**When** the ancestor SHA is resolved  
**Then** ✅ the GitHub Compare API is called at `GET /repos/{owner}/{repo}/compare/{head-sha}...{pr-sha}` and `merge_base_commit.sha` is used as the ancestor SHA — _`resolveAncestorSha` → `compareCommitsWithBasehead`_

### 2.16 Monorepo — squash per-package manifests before comparison

**Given** the `workflow` input is `manifest-compare` and `package-paths` is non-empty  
**When** the action resolves the PR manifest  
**Then**:

- ❌ All per-package manifests at `manifests/{pr-sha}/{package-path}.json` are downloaded and merged into a single manifest — _not implemented_
- ❌ The squashed manifest is uploaded to `manifests/{pr-sha}.json` — _not implemented_
- ❌ The squashed manifest is used alongside the pre-existing `manifests/{head-sha}.json` and `manifests/{ancestor-sha}.json` for the 3-way comparison — _not implemented_

---

## 3. `manifest-merge` mode

### 3.1 Manifest always written for merge commit

**Given** the `workflow` input is `manifest-merge`  
**When** the action runs  
**Then** ✅ a manifest is always written to `manifests/{merge-commit-sha}.json`, regardless of whether a changeset exists — _`manifest-merge.ts:53` (no changeset) and `:69` (changeset)_

### 3.2 No changeset — copy parent manifest

**Given** no changeset exists at `changesets/{pr-head-sha}.json`  
**When** the action runs  
**Then**:

- ✅ The parent manifest (`manifests/{parent-sha}.json`) is copied as-is to `manifests/{merge-commit-sha}.json`
- ✅ No base images are updated
- ✅ No failure status is set

_`manifest-merge.ts:49-55`_

### 3.3 Conflict prevention — overlapping open PR changesets

**Given** a changeset exists for the merging PR, and at least one other open PR has a changeset that shares at least one screenshot path key with the merging PR's changeset  
**When** the merge action runs  
**Then**:

- ✅ A failure commit status is set on that other open PR's head SHA
- ✅ The failure status message indicates visual comparison is outdated and a rebase is required
- ❌ This check is performed for every open PR that has a changeset in S3 — _`manifest-merge-flag-prs.ts:38-41` calls `pulls.list` with no pagination/`per_page` (default 30); open PRs beyond the first page are never inspected_

### 3.4 Stale changeset — no overlapping paths → proceed

**Given** the changeset's `_headSha` does not match the merge commit's first parent SHA, but none of the changeset's screenshot keys differ between `manifests/{changeset._headSha}.json` and `manifests/{parents[0].sha}.json`  
**When** the merge action runs  
**Then** ✅ the merge proceeds normally (the intervening merges didn't touch the same screenshots) — _`detectStaleConflicts` returns `[]` → `assertNoStaleConflicts` returns early_

### 3.5 Stale changeset — overlapping paths → fail

**Given** the changeset's `_headSha` does not match the merge commit's first parent SHA, and at least one changeset key has a different hash in `manifests/{changeset._headSha}.json` vs `manifests/{parents[0].sha}.json`  
**When** the merge action runs  
**Then**:

- ✅ The action fails
- ✅ The conflicting paths are listed in the failure output

_`manifest-merge.ts:73-92`_

### 3.6 Overlay — non-null entries update hash

**Given** a valid (non-stale) changeset exists  
**When** the changeset is overlaid onto the parent manifest  
**Then** ✅ for each non-null entry in the changeset, the corresponding key in the resulting manifest has the changeset's hash value — _`manifest-merge-overlay.ts:21-22`_

### 3.7 Overlay — null entries remove key

**Given** a valid changeset contains a `null` entry for a path  
**When** the changeset is overlaid onto the parent manifest  
**Then** ✅ that path is absent from `manifests/{merge-commit-sha}.json` — _`manifest-merge-overlay.ts:19-20`_

### 3.8 Base image update — non-null entries

**Given** a valid changeset is applied  
**When** base images are updated  
**Then** ✅ for each non-null changeset entry, `new-images/{pr-sha}/path/new.png` is copied to `base-images/path/base.png` — _`manifest-merge-base-images.ts:56-66`_

### 3.9 Base image update — null entries delete base image

**Given** a valid changeset contains a `null` entry for a path  
**When** base images are updated  
**Then** ✅ `base-images/path/base.png` is deleted from S3 — _`manifest-merge-base-images.ts:67-76`_

### 3.10 Parent SHA resolution

**Given** the merge commit SHA is known  
**When** the parent manifest is fetched  
**Then** ✅ the GitHub API is called to get `parents[0].sha` of the merge commit, and `manifests/{parents[0].sha}.json` is used as the parent manifest — _`run.ts:355-366`_

---

## 4. General / Cross-cutting

### 4.1 New modes do not affect existing modes

**Given** the `workflow` input is `pr` or `merge`  
**When** the action runs  
**Then** ✅ behavior is identical to before this implementation — no regressions in existing modes — _`run.ts:37-50` dispatches new modes and returns early; legacy code path unchanged_

### 4.2 Manifest key format — monorepo

**Given** the action is run in a monorepo with a non-empty `package-paths` input  
**When** manifest entries are keyed  
**Then** ❌ each key is prefixed with the package path (e.g. `packages/ui/components/Button`, not just `components/Button`) — _`manifest-generate.ts:38-43` derives keys solely from the path relative to `screenshots-directory` and ignores `package-paths`. Additionally, the documented matrix flow (`docs/.../manifest-workflows.md:89-129`) has each per-package job write the same `manifests/{commit-sha}.json`, so jobs overwrite one another_

### 4.3 Manifest key format — single package

**Given** no `package-paths` input is set  
**When** manifest entries are keyed  
**Then** ✅ each key is the screenshot directory's path relative to the screenshots root (no prefix) — _`manifest-generate.ts:39-40`_

### 4.4 S3 key structure is exact

**Given** the implementation writes or reads any manifest, changeset, or image  
**Then** the following exact S3 key patterns are used:

- ✅ Manifests (single-package, or squashed by compare for monorepo): `manifests/{commit-sha}.json`
- ❌ Manifests (monorepo, written by generate per package): `manifests/{commit-sha}/{package-path}.json` — _not implemented_
- ✅ Changesets: `changesets/{pr-head-sha}.json`
- ✅ New images: `new-images/{commit-sha}/path/new.png` (resized if resize is enabled, full-size otherwise)
- ✅ Base images: `base-images/path/base.png` (same dimensions as `new-images/` — resized if resize is enabled)
- ❌ `original-new-images/` is never written by any manifest mode — _violated by `manifest-generate.ts:70-74` (see 1.1)_

### 4.5 MD5 hashing implementation

**Given** a screenshot file is hashed  
**Then** ✅ Node.js `crypto` is used to compute the MD5 hash of the full-size image file — _`hash.ts:1-7`_

### 4.6 Concurrency constraint is documented

**Given** the implementation is complete  
**Then** ✅ the documentation (README, `action.yml` input descriptions, or equivalent) explicitly states that consumers using `manifest-merge` must configure a `concurrency` group with `cancel-in-progress: false` on their merge workflow to prevent concurrent merge races — _`docs/docs/setup/manifest-workflows.md:135,145-147`_
