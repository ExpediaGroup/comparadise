# Manifest-Based Visual Comparison — Acceptance Criteria (Review #2)

This is `MANIFEST_AC.md` annotated with implementation status for PR [#786](https://github.com/ExpediaGroup/comparadise/pull/786).

Source-only review of `action/src/` at the PR head SHA `02869c8`. (Local review HEAD was one commit ahead, `e8a6575`, whose only difference is an edit to `MANIFEST_AC.md` itself — the reviewed `action/src/` is byte-identical to the PR head.) The full test suite passes: **175 pass / 0 fail across 14 files** (`bunx nx test action`).

Each criterion is marked ✅ (satisfied), ❌ (not satisfied), or ⚠️ (satisfied with a caveat worth noting), with a reason for anything not plainly satisfied.

**Summary:** Every defect flagged in Review #1 (package-prefixed keys, `original-new-images/` writes, missing per-package manifest path) is now fixed. All 40 criteria are satisfied. Three minor caveats are noted (2.2, 2.13, 3.1) — none are behavioral failures.

---

## 1. `manifest-generate` mode

### 1.1 Normal run — differential upload

- ✅ MD5 of each `new.png` via Node `crypto` from the full-size file on disk — `hash.ts` reads the file and `createHash('md5')`; called at `manifest-generate.ts:56` before any resize.
- ✅ Each entry keyed by path relative to the screenshots root, prefixed with package path for monorepos — `manifest-generate.ts:53-55` (`manifestKey = packagePath ? \`${packagePath}/${localKey}\` : localKey`). _(Review #1 ❌ → now fixed.)_
- ✅ Only changed images uploaded to `new-images/{commit-sha}/path/new.png` — `changedEntries` filter (`manifest-generate.ts:65-67`), key at `manifest-generate.ts:80`.
- ✅ Resize enabled → resized before upload — `:75-77`.
- ✅ Resize not enabled → full-size — `:75-77` (`resizeEnabled` false path passes the raw buffer).
- ✅ Matching-hash images not uploaded — filter excludes them.
- ✅ Nothing written to `original-new-images/` — no such write exists in `manifest-generate.ts`. _(Review #1 ❌ → now fixed.)_
- ✅ Manifest written to `manifests/{commit-sha}.json` mapping **all** screenshots — `manifest` built from every entry (`manifest-generate.ts:57`), written at `manifest-generate.ts:89-94`.

### 1.2 First run — no HEAD manifest exists

- ✅ Missing manifest treated as empty — `fetchHeadManifest` returns `null` on `NoSuchKey` (`manifest-generate.ts:113-118`); also `null` when `head-sha` not supplied (`manifest-generate.ts:61-63`). Filter `!headManifest || ...` ⇒ upload all.
- ✅ All images uploaded following 1.1 resize rules.
- ✅ Manifest written for all screenshots.

### 1.3 Hashing always from full-size image

- ✅ Hash taken at `manifest-generate.ts:56` from the on-disk file; resize only ever touches the upload buffer (`manifest-generate.ts:75`), never the hash input.

### 1.4 Monorepo — per-package manifest path

- ✅ When `packagePath` is set, manifest written to `manifests/{commit-sha}/{package-path}.json` (`manifest-generate.ts:86-88`); falls back to `manifests/{commit-sha}.json` otherwise. A `package-paths` value with >1 entry is rejected with a clear `setFailed` (`manifest-generate.ts:22-28`), enforcing one package per matrix job. _(Review #1 ❌ → now fixed.)_

---

## 2. `manifest-compare` mode

### 2.1 All hashes match — success

- ✅ `classifyManifests` returns `{ outcome: 'match' }` when `differingPaths` is empty (`manifest-compare-classify.ts:49-55`); `manifestCompare` sets a success status and returns (`manifest-compare.ts:62-71`) — no changeset, no comment.

### 2.2 PR Owns — PR introduced a visual diff (changed)

- ✅ Classified `changed` when `headHash === ancestorHash` and both PR/ancestor are non-null (`manifest-compare-classify.ts:73-81`).
- ✅ `base.png` downloaded from `base-images/path/base.png` (`manifest-diff.ts:31,34`).
- ✅ `new.png` downloaded from `new-images/{pr-sha}/path/new.png` (`manifest-diff.ts:32`).
- ✅ `diff.png` generated via pixelmatch (`diff-png.ts`, `manifest-diff.ts:39`).
- ⚠️ `base.png` and `diff.png` uploaded to `new-images/{pr-sha}/path/{base,diff}.png` (`manifest-diff.ts:41-52`). **Caveat:** they are uploaded as-is, with no explicit resize call. This still satisfies the intent because both source images are already resized at rest — `base-images/` is populated from already-resized `new-images/` during merge, and `new-images/` is resized at generate time — so the generated diff and the re-uploaded base are already at resized dimensions. The behavior is correct; it just achieves "resized" implicitly rather than by re-running resize. Worth a confirming test if resize correctness here is load-bearing.

### 2.3 PR Owns — new screenshot (not in HEAD or ancestor)

- ✅ Classified `added` (`headHash === ancestorHash === null`, `manifest-compare-classify.ts:75-76`).
- ✅ No `base.png` download / no `diff.png` — `generateDiffs` processes only `type === 'changed'` (`manifest-diff.ts:23`).
- ✅ Only `new.png` referenced (already uploaded by generate).
- ✅ Counts toward pending status and comment — `reviewable` includes `added` (`manifest-compare.ts:122`); comment reports `addedCount` (`run.ts:437`).

### 2.4 PR Owns — deleted screenshot (PR deleted, HEAD = ancestor)

- ✅ Classified `deleted` (`prHash === null`, ancestor non-null, `manifest-compare-classify.ts:77-78`).
- ✅ Deletion logged as info — `manifest-compare.ts:125-127`.
- ✅ Recorded as `null` in the changeset — `manifest-compare.ts:170-171`.
- ✅ Does not contribute to pending/comment — excluded from `reviewable`; a deletions-only PR yields a **success** status and no comment (`manifest-compare.ts:133-144`).

### 2.5 Main Owns — main changed, PR clean

- ✅ `prHash === ancestorHash` ⇒ `mainOwns` (`manifest-compare-classify.ts:82-84`). No diff, not in changeset (`buildChangeset` at `manifest-compare.ts:163-183` iterates only `prOwns`), no pending/failure from this path alone.

### 2.6 Main Owns — screenshot added on main since branching

- ✅ HEAD has it, PR/ancestor don't ⇒ `prHash === ancestorHash === null` ⇒ `mainOwns` (`manifest-compare-classify.ts:82-84`).

### 2.7 Conflict — all three hashes differ

- ✅ Reaches the `else` (conflict) branch only when `headHash !== ancestorHash` **and** `prHash !== ancestorHash` (`manifest-compare-classify.ts:85-87`). Because `differingPaths` is pre-filtered to `prManifest[p] !== headManifest[p]` (`manifest-compare-classify.ts:49-51`), `prHash !== headHash` is also guaranteed here — so the conflict branch correctly fires only when all three differ, and never when PR and main coincidentally made the same change.

### 2.8 Outcome: any conflict → failure

- ✅ `handleConflicts` sets `setFailed`, a failure commit status, and posts a conflict comment (`manifest-compare.ts:94-113`). No changeset is written (returns before `putChangeset`). Comment lists conflicting paths with a rebase instruction (`run.ts:430-431`).

### 2.10 Outcome: all Main Owns → success

- ✅ `prOwns.length === 0` ⇒ success status (`manifest-compare.ts:78-89`).

### 2.11 Outcome: ≥1 PR Owns, no conflicts → pending

- ✅ `handlePrOwns` writes the changeset (`manifest-compare.ts:131`), sets pending status with `target_url` (`manifest-compare.ts:148-154`), and posts the diffs comment (`manifest-compare.ts:156-160`). _(Consistent with 2.4: a PR-Owns set that is **only** deletions instead yields success + no comment, which is the documented deletions behavior, not a regression.)_

### 2.12 Changeset schema

- ✅ Written to `changesets/{pr-head-sha}.json` (`manifest-s3.ts:39-50`, `sha = prSha`).
- ✅ `_headSha` = the HEAD SHA resolved in compare step 2 (`result.headSha`, `manifest-compare.ts:168`).
- ✅ One entry per PR-owned changed/added path with the PR's new hash (`manifest-compare.ts:172-180`).
- ✅ One `null` entry per PR-deleted path (`manifest-compare.ts:170-171`).
- ✅ Main Owns excluded (loop iterates only `prOwns`).
- ✅ Contains only PR-introduced paths. Defensive guard throws if a non-deleted entry is missing its PR hash (`manifest-compare.ts:174-178`).

### 2.13 Missing ancestor manifest

- ⚠️ `requireAncestorManifest` throws with the exact required guidance ("Ensure `manifest-generate` has run on the base branch, then rebase your branch onto a commit that has a manifest", `manifest-compare-classify.ts:137-149`). The action does fail and the message surfaces. **Caveat:** the failure is delivered by a thrown `Error` that is **not** caught at the top level — `main.ts` is just `run();` with no `.catch()`, so it surfaces as an unhandled rejection (non-zero exit + stderr) rather than via `core.setFailed`. This matches the pre-existing `pr`/`merge` error style, so it's consistent, but routing it through `core.setFailed` would produce a cleaner Actions annotation.

### 2.14 HEAD SHA resolution

- ✅ `octokit.rest.repos.getBranch({ ...repo, branch: baseRef })` → `data.commit.sha` (`manifest-compare-classify.ts:151-161`) — the live branches endpoint, not a cached value.

### 2.15 Ancestor SHA resolution

- ✅ `octokit.rest.repos.compareCommitsWithBasehead({ basehead: \`${headSha}...${prSha}\` })`→`merge_base_commit.sha` (`manifest-compare-classify.ts:163-174`).

### 2.16 Monorepo — squash per-package manifests before comparison

- ✅ `squashPrManifest` lists `manifests/{pr-sha}/`, merges all parts, and uploads the combined `manifests/{pr-sha}.json` (`manifest-s3.ts:80-109`); duplicate keys across packages throw. No-op (returns `null`, writes nothing) for single-package PRs. `classifyManifests` (`manifest-compare-classify.ts`) then reads the squashed `manifests/{pr-sha}.json` alongside HEAD and ancestor manifests.

---

## 3. `manifest-merge` mode

### 3.1 Manifest always written for merge commit

- ⚠️ Written on both the no-changeset path (`manifest-merge.ts:53`) and the normal overlay path (`manifest-merge.ts:69`). **Caveat:** when a stale changeset has overlapping conflicts (3.5), `assertNoStaleConflicts` throws **before** `putManifest`, so no manifest is written in that case. This is the correct behavior for a hard failure (you do not want to publish a manifest you just declared conflicting), and 3.5 explicitly requires the action to fail — so "always written" holds for every non-failing path. Flagging only because the literal wording is "regardless of whether a changeset exists."

### 3.2 No changeset — copy parent manifest

- ✅ `parentManifest` copied verbatim to `manifests/{merge-commit-sha}.json` (`manifest-merge.ts:49-55`); returns before any base-image update or status change.

### 3.3 Conflict prevention — overlapping open PR changesets

- ✅ `flagOverlappingOpenPrs` paginates **all** open PRs, loads each one's changeset, and on any shared screenshot path sets a `failure` commit status on that PR's head SHA with "Visual comparison outdated — please rebase." (`manifest-merge-flag-prs.ts:38-69`). Skips the merging PR itself (`manifest-merge-flag-prs.ts:46`).

### 3.4 Stale changeset — no overlapping paths → proceed

- ✅ When `_headSha !== parentSha`, `detectStaleConflicts` compares `manifests/{_headSha}` vs `manifests/{parent}` on changeset keys; empty result ⇒ returns and the merge proceeds (`manifest-merge.ts:64-66`, `:88`).

### 3.5 Stale changeset — overlapping paths → fail

- ✅ Non-empty conflicts ⇒ `core.setFailed` with the conflicting paths listed, then throw (`manifest-merge.ts:88-92`).

### 3.6 Overlay — non-null entries update hash

- ✅ `overlayChangeset` sets `result[path] = hash` for non-null entries (`manifest-merge-overlay.ts:17-24`); parent manifest not mutated (spread copy).

### 3.7 Overlay — null entries remove key

- ✅ `delete result[path]` for null entries (`manifest-merge-overlay.ts:19-21`).

### 3.8 Base image update — non-null entries

- ✅ `applyChangesetToBaseImages` copies `new-images/{pr-sha}/path/new.png` → `base-images/path/base.png` (`manifest-merge-base-images.ts:55-66`), with a properly URI-encoded `CopySource`.

### 3.9 Base image update — null entries delete base image

- ✅ `deleteObjects` removes `base-images/path/base.png` for null entries (`manifest-merge-base-images.ts:67-77`).

### 3.10 Parent SHA resolution

- ✅ `octokit.rest.repos.getCommit({ ref: mergeSha })` → `data.parents[0].sha`, used as the parent manifest key (`run.ts:356-368`); throws if no parent exists.

---

## 4. General / Cross-cutting

### 4.1 New modes do not affect existing modes

- ✅ `run.ts:37-50` dispatches the three manifest modes and returns early; the `pr`/`merge` code paths below are untouched. Covered by `run.test.ts`.

### 4.2 Manifest key format — monorepo

- ✅ Keys prefixed with the package path (`manifest-generate.ts:55`).

### 4.3 Manifest key format — single package

- ✅ No prefix when `package-paths` unset (`packagePath = ''` ⇒ `manifestKey = localKey`).

### 4.4 S3 key structure is exact

- ✅ Manifests (single/squashed): `manifests/{sha}.json` (`manifest-s3.ts`, `manifest-generate.ts:88`).
- ✅ Manifests (monorepo generate): `manifests/{sha}/{package-path}.json` (`manifest-generate.ts:86-87`).
- ✅ Changesets: `changesets/{sha}.json` (`manifest-s3.ts:43`).
- ✅ New images: `new-images/{sha}/path/new.png`, resized when enabled (`manifest-generate.ts:80`).
- ✅ Base images: `base-images/path/base.png`, populated by copy from already-resized `new-images/` (`manifest-merge-base-images.ts:63`).
- ✅ `original-new-images/` never written by any manifest mode (grep-confirmed; constant `ORIGINAL_NEW_IMAGES_DIRECTORY` is unused outside legacy `pr` mode).

### 4.5 MD5 hashing implementation

- ✅ `hash.ts` uses Node `crypto` `createHash('md5')` over the full-size file buffer.

### 4.6 Concurrency constraint is documented

- ✅ `docs/docs/setup/manifest-workflows.md:137-149` states the `manifest-merge` workflow must set a `concurrency` group with `cancel-in-progress: false`, with the rationale, and the example YAML includes it.

---

## Verdict

All 40 acceptance criteria are satisfied. The defects from Review #1 are resolved and the test suite is green. The three ⚠️ caveats (2.2 implicit resize, 2.13 thrown error vs `core.setFailed`, 3.1 no manifest on the stale-conflict failure path) are correctness-neutral and optional to address; none block acceptance.
