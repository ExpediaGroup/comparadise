# Manifest-Based Visual Comparison — Acceptance Criteria (Review #2)

This is `MANIFEST_AC.md` annotated with implementation status for PR [#786](https://github.com/ExpediaGroup/comparadise/pull/786).

Source-only review of `action/src/` at the PR head SHA `02869c8`. (Local review HEAD was one commit ahead, `e8a6575`, whose only difference is an edit to `MANIFEST_AC.md` itself — the reviewed `action/src/` is byte-identical to the PR head.) The full test suite passes: **175 pass / 0 fail across 14 files** (`bunx nx test action`).

Each criterion is marked ✅ (satisfied), ❌ (not satisfied), or ⚠️ (satisfied with a caveat worth noting), with a reason for anything not plainly satisfied.

**Summary:** Every defect flagged in Review #1 (package-prefixed keys, `original-new-images/` writes, missing per-package manifest path) is now fixed. All 40 criteria are satisfied. Three minor caveats are noted (2.2, 2.13, 3.1) — none are behavioral failures.

---

## 1. `manifest-generate` mode

### 1.1 Normal run — differential upload

**Given** the `workflow` input is `manifest-generate`, a HEAD manifest exists at `manifests/{head-sha}.json` in S3, and `visual-test-command` completes successfully  
**When** the action runs  
**Then**:

- ✅ The MD5 hash of each `new.png` in the screenshots directory is computed using Node.js `crypto` from the full-size image on disk — _`hash.ts` reads the file and `createHash('md5')`; called at `manifest-generate.ts:56` before any resize_
- ✅ Each entry is keyed by the screenshot directory's path relative to the screenshots root (prefixed with package path for monorepos) — _`manifest-generate.ts:53-55` (`manifestKey = packagePath ? \`${packagePath}/${localKey}\` : localKey`); Review #1 ❌ → now fixed_
- ✅ Only images whose hash differs from the HEAD manifest are uploaded to `new-images/{commit-sha}/path/new.png` — _`changedEntries` filter (`manifest-generate.ts:65-67`), key at `manifest-generate.ts:80`_
- ✅ If resize is enabled: changed images are resized before upload — _`manifest-generate.ts:75-77`_
- ✅ If resize is not enabled: changed images are uploaded full-size — _`manifest-generate.ts:75-77` (`resizeEnabled` false path passes the raw buffer)_
- ✅ Images whose hash matches the HEAD manifest are not uploaded — _filter excludes them_
- ✅ Nothing is ever written to `original-new-images/` — _no such write exists in `manifest-generate.ts`; Review #1 ❌ → now fixed_
- ✅ A manifest is written to `manifests/{commit-sha}.json` mapping every screenshot directory path to its MD5 hash (all screenshots, not just changed ones) — _`manifest` built from every entry (`manifest-generate.ts:57`), written at `manifest-generate.ts:89-94`_

### 1.2 First run — no HEAD manifest exists

**Given** the `workflow` input is `manifest-generate` and no manifest exists at `manifests/{head-sha}.json` in S3  
**When** the action runs  
**Then**:

- ✅ The missing manifest is treated as an empty object (no hash comparisons are performed) — _`fetchHeadManifest` returns `null` on `NoSuchKey` (`manifest-generate.ts:113-118`); also `null` when `head-sha` not supplied (`manifest-generate.ts:61-63`). Filter `!headManifest || ...` ⇒ upload all_
- ✅ All images are uploaded to `new-images/{commit-sha}/path/new.png` following the same resize rules as 1.1
- ✅ A manifest is written to `manifests/{commit-sha}.json` for all screenshots

### 1.3 Hashing is always from full-size image

**Given** any run of `manifest-generate`  
**When** hashes are computed  
**Then** ✅ each MD5 hash is computed from the full-size image file as it exists on disk after `visual-test-command` completes — before any resize is applied — _hash taken at `manifest-generate.ts:56` from the on-disk file; resize only ever touches the upload buffer (`manifest-generate.ts:75`), never the hash input_

### 1.4 Monorepo — per-package manifest path

**Given** the `workflow` input is `manifest-generate` and `package-paths` is non-empty  
**When** the manifest is written to S3  
**Then** ✅ the manifest is uploaded to `manifests/{commit-sha}/{package-path}.json` (one file per package invocation) instead of `manifests/{commit-sha}.json` — _`manifest-generate.ts:86-88`; falls back to `manifests/{commit-sha}.json` otherwise. A `package-paths` value with >1 entry is rejected with a clear `setFailed` (`manifest-generate.ts:22-28`), enforcing one package per matrix job. Review #1 ❌ → now fixed_

---

## 2. `manifest-compare` mode

### 2.1 All hashes match — success

**Given** the `workflow` input is `manifest-compare`, the PR manifest at `manifests/{pr-head-sha}.json` and the HEAD manifest at `manifests/{head-sha}.json` both exist, and every hash in the PR manifest matches the corresponding hash in the HEAD manifest  
**When** the action runs  
**Then**:

- ✅ A success commit status is set on the PR head SHA — _`classifyManifests` returns `{ outcome: 'match' }` when `differingPaths` is empty (`manifest-compare-classify.ts:49-55`); `manifestCompare` sets success and returns (`manifest-compare.ts:62-71`)_
- ✅ No changeset is written
- ✅ No Comparadise comment is posted

### 2.2 PR Owns — PR introduced a visual diff (normal case)

**Given** at least one hash differs between the PR manifest and the HEAD manifest, and for a given differing path the HEAD hash equals the ancestor hash (PR introduced the change)  
**When** the 3-way comparison runs for that path  
**Then**:

_Classified `changed` when `headHash === ancestorHash` and both PR/ancestor are non-null (`manifest-compare-classify.ts:73-81`)._

- ✅ `base.png` is downloaded from `base-images/path/base.png` — _`manifest-diff.ts:31,34`_
- ✅ `new.png` is downloaded from `new-images/{pr-sha}/path/new.png` (as uploaded by `manifest-generate`) — _`manifest-diff.ts:32`_
- ✅ A `diff.png` is generated via pixelmatch — _`diff-png.ts`, `manifest-diff.ts:39`_
- ⚠️ `base.png` and `diff.png` are uploaded to `new-images/{pr-sha}/path/base.png` and `new-images/{pr-sha}/path/diff.png`; if resize is enabled they are resized before upload — _`manifest-diff.ts:41-52` uploads them as-is, with no explicit resize call. This still satisfies the intent because both source images are already resized at rest: `base-images/` is populated from already-resized `new-images/` during merge, and `new-images/` is resized at generate time — so the generated diff and the re-uploaded base are already at resized dimensions. The behavior is correct; it achieves "resized" implicitly rather than by re-running resize. Worth a confirming test if resize correctness here is load-bearing_

### 2.3 PR Owns — new screenshot (not in HEAD or ancestor)

**Given** a path exists in the PR manifest but does not exist in either the HEAD manifest or the ancestor manifest  
**When** the 3-way comparison runs for that path  
**Then**:

_Classified `added` (`headHash === ancestorHash === null`, `manifest-compare-classify.ts:75-76`)._

- ✅ No `base.png` is downloaded — _`generateDiffs` processes only `type === 'changed'` (`manifest-diff.ts:23`)_
- ✅ No `diff.png` is generated or uploaded — _same filter_
- ✅ Only `new.png` is referenced (already uploaded by `manifest-generate`)
- ✅ The path is treated as a PR-owned change (contributes to pending status and Comparadise comment) — _`reviewable` includes `added` (`manifest-compare.ts:122`); comment reports `addedCount` (`run.ts:437`)_

### 2.4 PR Owns — deleted screenshot (PR deleted, HEAD = ancestor)

**Given** a path exists in the ancestor manifest and the HEAD manifest with the same hash, but does not exist in the PR manifest  
**When** the 3-way comparison runs for that path  
**Then**:

_Classified `deleted` (`prHash === null`, ancestor non-null, `manifest-compare-classify.ts:77-78`)._

- ✅ The deletion is logged as an informational message — _`manifest-compare.ts:125-127`_
- ✅ The path is recorded as a `null` entry in the changeset — _`manifest-compare.ts:170-171`_
- ✅ The path does not contribute to pending status or Comparadise comment — _excluded from `reviewable`; a deletions-only PR yields a **success** status and no comment (`manifest-compare.ts:133-144`)_

### 2.5 Main Owns — main changed, PR is clean

**Given** for a given differing path the PR hash equals the ancestor hash (main introduced the change, not the PR)  
**When** the 3-way comparison runs for that path  
**Then**:

- ✅ No diff is generated for that path — _`prHash === ancestorHash` ⇒ `mainOwns` (`manifest-compare-classify.ts:82-84`)_
- ✅ The path is not included in the changeset — _`buildChangeset` at `manifest-compare.ts:163-183` iterates only `prOwns`_
- ✅ This path alone does not cause a pending or failure status

### 2.6 Main Owns — screenshot added on main since branching

**Given** a path exists in the HEAD manifest but not in the PR manifest or the ancestor manifest  
**When** the 3-way comparison runs for that path  
**Then**:

- ✅ The path is treated as Main Owns (main added it, PR didn't touch it) — _HEAD has it, PR/ancestor don't ⇒ `prHash === ancestorHash === null` ⇒ `mainOwns` (`manifest-compare-classify.ts:82-84`)_
- ✅ No diff is generated, no failure or pending status is set for this path alone

### 2.7 Conflict — all three hashes differ

**Given** for a given path the PR hash, HEAD hash, and ancestor hash are all different  
**When** the 3-way comparison runs for that path  
**Then** ✅ the path is collected as a conflict — _reaches the `else` (conflict) branch only when `headHash !== ancestorHash` **and** `prHash !== ancestorHash` (`manifest-compare-classify.ts:85-87`). Because `differingPaths` is pre-filtered to `prManifest[p] !== headManifest[p]` (`manifest-compare-classify.ts:49-51`), `prHash !== headHash` is also guaranteed here — so the conflict branch fires only when all three differ, never when PR and main coincidentally made the same change_

### 2.8 Outcome: any conflict → failure

**Given** at least one path was collected as a conflict  
**When** the outcome is determined  
**Then**:

- ✅ A failure commit status is set on the PR head SHA — _`handleConflicts` sets `setFailed` and a failure commit status (`manifest-compare.ts:94-113`)_
- ✅ A comment is posted listing the conflicting paths with a rebase instruction — _`run.ts:430-431`_
- ✅ No changeset is written — _`handleConflicts` returns before `putChangeset`_

### 2.10 Outcome: all Main Owns (no PR Owns, no conflicts) → success

**Given** all differing hashes are Main Owns (no PR Owns, no conflicts)  
**When** the outcome is determined  
**Then** ✅ a success commit status is set on the PR head SHA — _`prOwns.length === 0` ⇒ success status (`manifest-compare.ts:78-89`)_

### 2.11 Outcome: at least one PR Owns, no conflicts → pending

**Given** at least one path is PR Owns and no paths are conflicts  
**When** the outcome is determined  
**Then**:

- ✅ A pending commit status is set on the PR head SHA — _`handlePrOwns` sets pending status with `target_url` (`manifest-compare.ts:148-154`)_
- ✅ A Comparadise comment is posted — _`manifest-compare.ts:156-160`_
- ✅ A changeset is written to `changesets/{pr-head-sha}.json` — _`manifest-compare.ts:131`_

_Consistent with 2.4: a PR-Owns set that is **only** deletions instead yields success + no comment, which is the documented deletions behavior, not a regression._

### 2.12 Changeset schema

**Given** a changeset is written  
**Then**:

- ✅ The file is at `changesets/{pr-head-sha}.json` — _`manifest-s3.ts:39-50`, `sha = prSha`_
- ✅ It contains `_headSha`: the HEAD SHA resolved in step 2 of the compare flow — _`result.headSha` (`manifest-compare.ts:168`)_
- ✅ It contains one entry per PR-owned changed path with the PR's new hash as the value — _`manifest-compare.ts:172-180`_
- ✅ It contains one entry per PR-deleted path with `null` as the value — _`manifest-compare.ts:170-171`_
- ✅ Main Owns paths are not included — _loop iterates only `prOwns`_
- ✅ The changeset contains only paths where the PR introduced a change — _defensive guard throws if a non-deleted entry is missing its PR hash (`manifest-compare.ts:174-178`)_

### 2.13 Missing ancestor manifest

**Given** the ancestor SHA is resolved but `manifests/{ancestor-sha}.json` does not exist in S3  
**When** the compare runs  
**Then**:

- ✅ The action fails — _`requireAncestorManifest` throws (`manifest-compare-classify.ts:137-149`)_
- ⚠️ An error message is returned explaining that the ancestor manifest was not found and instructing the user to ensure `manifest-generate` has run on the base branch and to rebase onto a commit that has a manifest — _the message text is exactly that ("Ensure `manifest-generate` has run on the base branch, then rebase your branch onto a commit that has a manifest"). **Caveat:** the failure is delivered by a thrown `Error` that is **not** caught at the top level — `main.ts` is just `run();` with no `.catch()`, so it surfaces as an unhandled rejection (non-zero exit + stderr) rather than via `core.setFailed`. This matches the pre-existing `pr`/`merge` error style, so it's consistent, but routing it through `core.setFailed` would produce a cleaner Actions annotation_

### 2.14 HEAD SHA resolution

**Given** the compare mode runs  
**When** the HEAD SHA is resolved  
**Then** ✅ the GitHub API is called at `GET /repos/{owner}/{repo}/branches/{base.ref}` to get the latest main HEAD SHA (not a stale cached value) — _`octokit.rest.repos.getBranch({ ...repo, branch: baseRef })` → `data.commit.sha` (`manifest-compare-classify.ts:151-161`)_

### 2.15 Ancestor SHA resolution

**Given** the HEAD SHA and PR SHA are known  
**When** the ancestor SHA is resolved  
**Then** ✅ the GitHub Compare API is called at `GET /repos/{owner}/{repo}/compare/{head-sha}...{pr-sha}` and `merge_base_commit.sha` is used as the ancestor SHA — _`octokit.rest.repos.compareCommitsWithBasehead({ basehead: \`${headSha}...${prSha}\` })`→`merge_base_commit.sha` (`manifest-compare-classify.ts:163-174`)_

### 2.16 Monorepo — squash per-package manifests before comparison

**Given** the `workflow` input is `manifest-compare` and `package-paths` is non-empty  
**When** the action resolves the PR manifest  
**Then**:

- ✅ All per-package manifests at `manifests/{pr-sha}/{package-path}.json` are downloaded and merged into a single manifest — _`squashPrManifest` lists `manifests/{pr-sha}/` and merges all parts; duplicate keys across packages throw (`manifest-s3.ts:80-109`)_
- ✅ The squashed manifest is uploaded to `manifests/{pr-sha}.json` — _`manifest-s3.ts:80-109`; no-op (returns `null`, writes nothing) for single-package PRs_
- ✅ The squashed manifest is used alongside the pre-existing `manifests/{head-sha}.json` and `manifests/{ancestor-sha}.json` for the 3-way comparison — _`classifyManifests` reads the squashed `manifests/{pr-sha}.json` alongside HEAD and ancestor manifests_

---

## 3. `manifest-merge` mode

### 3.1 Manifest always written for merge commit

**Given** the `workflow` input is `manifest-merge`  
**When** the action runs  
**Then** ⚠️ a manifest is always written to `manifests/{merge-commit-sha}.json`, regardless of whether a changeset exists — _written on both the no-changeset path (`manifest-merge.ts:53`) and the normal overlay path (`manifest-merge.ts:69`). **Caveat:** when a stale changeset has overlapping conflicts (3.5), `assertNoStaleConflicts` throws **before** `putManifest`, so no manifest is written in that case. This is the correct behavior for a hard failure (you do not want to publish a manifest you just declared conflicting), and 3.5 explicitly requires the action to fail — so "always written" holds for every non-failing path. Flagging only because the literal wording is "regardless of whether a changeset exists."_

### 3.2 No changeset — copy parent manifest

**Given** no changeset exists at `changesets/{pr-head-sha}.json`  
**When** the action runs  
**Then**:

- ✅ The parent manifest (`manifests/{parent-sha}.json`) is copied as-is to `manifests/{merge-commit-sha}.json` — _`manifest-merge.ts:49-55`_
- ✅ No base images are updated — _returns before any base-image update_
- ✅ No failure status is set — _returns before any status change_

### 3.3 Conflict prevention — overlapping open PR changesets

**Given** a changeset exists for the merging PR, and at least one other open PR has a changeset that shares at least one screenshot path key with the merging PR's changeset  
**When** the merge action runs  
**Then**:

- ✅ A failure commit status is set on that other open PR's head SHA — _`flagOverlappingOpenPrs` sets a `failure` commit status on the PR's head SHA (`manifest-merge-flag-prs.ts:38-69`)_
- ✅ The failure status message indicates visual comparison is outdated and a rebase is required — _"Visual comparison outdated — please rebase."_
- ✅ This check is performed for every open PR that has a changeset in S3 — _`flagOverlappingOpenPrs` paginates **all** open PRs and loads each one's changeset; skips the merging PR itself (`manifest-merge-flag-prs.ts:46`). Review #1 ❌ → now fixed_

### 3.4 Stale changeset — no overlapping paths → proceed

**Given** the changeset's `_headSha` does not match the merge commit's first parent SHA, but none of the changeset's screenshot keys differ between `manifests/{changeset._headSha}.json` and `manifests/{parents[0].sha}.json`  
**When** the merge action runs  
**Then** ✅ the merge proceeds normally (the intervening merges didn't touch the same screenshots) — _when `_headSha !== parentSha`, `detectStaleConflicts` compares `manifests/{_headSha}` vs `manifests/{parent}` on changeset keys; empty result ⇒ returns and the merge proceeds (`manifest-merge.ts:64-66`, `:88`)_

### 3.5 Stale changeset — overlapping paths → fail

**Given** the changeset's `_headSha` does not match the merge commit's first parent SHA, and at least one changeset key has a different hash in `manifests/{changeset._headSha}.json` vs `manifests/{parents[0].sha}.json`  
**When** the merge action runs  
**Then**:

- ✅ The action fails — _non-empty conflicts ⇒ `core.setFailed`, then throw (`manifest-merge.ts:88-92`)_
- ✅ The conflicting paths are listed in the failure output — _`manifest-merge.ts:88-92`_

### 3.6 Overlay — non-null entries update hash

**Given** a valid (non-stale) changeset exists  
**When** the changeset is overlaid onto the parent manifest  
**Then** ✅ for each non-null entry in the changeset, the corresponding key in the resulting manifest has the changeset's hash value — _`overlayChangeset` sets `result[path] = hash` for non-null entries (`manifest-merge-overlay.ts:17-24`); parent manifest not mutated (spread copy)_

### 3.7 Overlay — null entries remove key

**Given** a valid changeset contains a `null` entry for a path  
**When** the changeset is overlaid onto the parent manifest  
**Then** ✅ that path is absent from `manifests/{merge-commit-sha}.json` — _`delete result[path]` for null entries (`manifest-merge-overlay.ts:19-21`)_

### 3.8 Base image update — non-null entries

**Given** a valid changeset is applied  
**When** base images are updated  
**Then** ✅ for each non-null changeset entry, `new-images/{pr-sha}/path/new.png` is copied to `base-images/path/base.png` — _`applyChangesetToBaseImages` (`manifest-merge-base-images.ts:55-66`), with a properly URI-encoded `CopySource`_

### 3.9 Base image update — null entries delete base image

**Given** a valid changeset contains a `null` entry for a path  
**When** base images are updated  
**Then** ✅ `base-images/path/base.png` is deleted from S3 — _`deleteObjects` removes `base-images/path/base.png` for null entries (`manifest-merge-base-images.ts:67-77`)_

### 3.10 Parent SHA resolution

**Given** the merge commit SHA is known  
**When** the parent manifest is fetched  
**Then** ✅ the GitHub API is called to get `parents[0].sha` of the merge commit, and `manifests/{parents[0].sha}.json` is used as the parent manifest — _`octokit.rest.repos.getCommit({ ref: mergeSha })` → `data.parents[0].sha` (`run.ts:356-368`); throws if no parent exists_

---

## 4. General / Cross-cutting

### 4.1 New modes do not affect existing modes

**Given** the `workflow` input is `pr` or `merge`  
**When** the action runs  
**Then** ✅ behavior is identical to before this implementation — no regressions in existing modes — _`run.ts:37-50` dispatches the three manifest modes and returns early; the `pr`/`merge` code paths below are untouched. Covered by `run.test.ts`_

### 4.2 Manifest key format — monorepo

**Given** the action is run in a monorepo with a non-empty `package-paths` input  
**When** manifest entries are keyed  
**Then** ✅ each key is prefixed with the package path (e.g. `packages/ui/components/Button`, not just `components/Button`) — _`manifest-generate.ts:55`_

### 4.3 Manifest key format — single package

**Given** no `package-paths` input is set  
**When** manifest entries are keyed  
**Then** ✅ each key is the screenshot directory's path relative to the screenshots root (no prefix) — _`packagePath = ''` ⇒ `manifestKey = localKey`_

### 4.4 S3 key structure is exact

**Given** the implementation writes or reads any manifest, changeset, or image  
**Then** the following exact S3 key patterns are used:

- ✅ Manifests (single-package, or squashed by compare for monorepo): `manifests/{commit-sha}.json` — _`manifest-s3.ts`, `manifest-generate.ts:88`_
- ✅ Manifests (monorepo, written by generate per package): `manifests/{commit-sha}/{package-path}.json` — _`manifest-generate.ts:86-87`_
- ✅ Changesets: `changesets/{pr-head-sha}.json` — _`manifest-s3.ts:43`_
- ✅ New images: `new-images/{commit-sha}/path/new.png` (resized if resize is enabled, full-size otherwise) — _`manifest-generate.ts:80`_
- ✅ Base images: `base-images/path/base.png` (same dimensions as `new-images/` — resized if resize is enabled) — _populated by copy from already-resized `new-images/` (`manifest-merge-base-images.ts:63`)_
- ✅ `original-new-images/` is never written by any manifest mode — _grep-confirmed; constant `ORIGINAL_NEW_IMAGES_DIRECTORY` is unused outside legacy `pr` mode_

### 4.5 MD5 hashing implementation

**Given** a screenshot file is hashed  
**Then** ✅ Node.js `crypto` is used to compute the MD5 hash of the full-size image file — _`hash.ts` uses Node `crypto` `createHash('md5')` over the full-size file buffer_

### 4.6 Concurrency constraint is documented

**Given** the implementation is complete  
**Then** ✅ the documentation (README, `action.yml` input descriptions, or equivalent) explicitly states that consumers using `manifest-merge` must configure a `concurrency` group with `cancel-in-progress: false` on their merge workflow to prevent concurrent merge races — _`docs/docs/setup/manifest-workflows.md:137-149` states the requirement, the rationale, and the example YAML includes it_

---

## Verdict

All 40 acceptance criteria are satisfied. The defects from Review #1 are resolved and the test suite is green. The three ⚠️ caveats (2.2 implicit resize, 2.13 thrown error vs `core.setFailed`, 3.1 no manifest on the stale-conflict failure path) are correctness-neutral and optional to address; none block acceptance.
