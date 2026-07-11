# Manifest-Based Visual Comparison — Acceptance Criteria (Review #3)

This is `MANIFEST_AC.md` annotated with implementation status for PR [#786](https://github.com/ExpediaGroup/comparadise/pull/786).

Source-only review of `action/src/` at the PR head SHA `24b8637`, diffed against Review #2's SHA `da406b5`.

Each criterion is marked ✅ (satisfied), ❌ (not satisfied), or ⚠️ (satisfied with a caveat worth noting), with a reason for anything not plainly satisfied.

**Summary:** Since Review #2, `head-sha`/`base-ref`/`pr-sha`/`pr-number`/`merge-commit-sha` were removed from `action.yml` and all three modes now resolve their SHAs/refs from the triggering `pull_request` event (`manifest-run.ts`, `manifest-generate.ts:64-65`) — this closes Review #2's **4.7**, which has accordingly been deleted from `MANIFEST_AC.md` rather than left annotated. Unrelated to this PR's scope, `MANIFEST_AC.md` itself was also rewritten in the same window: **1.4/1.5/2.16/4.4 were redefined from a one-package-per-job model to a multi-package "chunk" model** (MD5-hashed `chunk-id`, multiple `package-paths` per job allowed). The source was **not** updated to match — `manifest-generate.ts` still rejects a `package-paths` list with more than one entry (`manifest-generate.ts:22-28`) and still names the per-package manifest file after the literal package path rather than an MD5 chunk-id (`manifest-generate.ts:91-93`). This is a regression relative to the currently-checked-in spec, not a new defect in behavior — the code hasn't changed since Review #2 rated the old (single-package) version of these criteria ❌→✅; the spec moved out from under it. Of the 34 criteria now in `MANIFEST_AC.md` (36 minus the deleted 4.7, plus new 1.5), 31 are satisfied; **1.4, 1.5, and 4.4's chunk-id bullet** are not.

All 102 existing manifest tests pass (`bun test`), consistent with the code matching its own (now-stale) tests rather than the current spec.

---

## 1. `manifest-generate` mode

### 1.1–1.3

No changes since Review #2 (`manifest-compare-classify.ts`/`manifest-diff.ts`/`manifest-s3.ts` changes in this window are a mechanical `response.Body!.transformTo...()` → guarded `readBody`/`readBodyBytes` helper refactor, not behavioral). Remain ✅ as previously assessed.

### 1.4 Monorepo — chunk manifest path

**Given** the `workflow` input is `manifest-generate` and `package-paths` is non-empty (one or more comma-separated packages — a "chunk")
**When** the manifest is written to S3
**Then**:

- ❌ A chunk identifier is derived deterministically from `package-paths`: the paths are trimmed, empties dropped, sorted, and joined, then MD5-hashed — _no such hashing exists anywhere in `action/src`; `grep -rn "chunk" action/src/` returns nothing_
- ❌ A single manifest is written to `manifests/{commit-sha}/{chunk-id}.json` — _`manifest-generate.ts:91-93` still writes `manifests/{commit-sha}/{packagePath}.json`, i.e. the literal (single) package path, not an MD5 chunk-id. Asserted by `manifest-generate.test.ts:283` (`expect(manifestCall![0].Key).toBe('manifests/abc123/packages/ui.json')`)_

### 1.5 Monorepo — multiple packages per job (chunk)

**Given** the `workflow` input is `manifest-generate` and `package-paths` lists more than one package
**When** the action runs
**Then**:

- ❌ The job is **not** rejected for listing multiple packages — _`manifest-generate.ts:22-28` calls `core.setFailed('manifest-generate expects a single package-paths value per matrix job; ...')` and returns whenever `packagePaths.length > 1`. Directly asserted by `manifest-generate.test.ts:291-299` ("fails when more than one package path is supplied to a single job")_
- ❌ Every screenshot under the screenshots root is included, keyed as-is (no package prefix) — _unreachable: the multi-package case always hits the `setFailed` guard above before any screenshot is processed_
- ❌ All packages' entries are written to the single chunk manifest file — _same reason; also no chunking mechanism exists per 1.4_
- ⚠️ Differential upload and resize behavior are otherwise identical to the single-package case — _true for the single-package path (unchanged, still ✅), but this bullet only has meaning once multi-package jobs are accepted_

---

## 2. `manifest-compare` mode

### 2.1–2.15

No changes since Review #2; all remain as previously assessed (all ✅, per Review #2's per-criterion notes).

### 2.16 Monorepo — squash chunk manifests before comparison

**Given** the `workflow` input is `manifest-compare` and `package-paths` is non-empty
**When** the action resolves the PR manifest
**Then**:

- ✅ All chunk manifests under `manifests/{pr-sha}/` are downloaded and merged into a single manifest — _`squashPrManifest` (`manifest-s3.ts:98-127`) lists everything under the `manifests/{sha}/` prefix and merges by content, not by filename, so it is agnostic to whether the per-job file is named after a literal package path (current behavior) or an MD5 chunk-id (spec) — this criterion holds regardless of how 1.4 is eventually resolved_
- ✅ The squashed manifest is uploaded to `manifests/{pr-sha}.json`
- ✅ The squashed manifest is used alongside `manifests/{head-sha}.json` and `manifests/{ancestor-sha}.json` for the 3-way comparison

---

## 3. `manifest-merge` mode

### 3.1–3.10

Unchanged since Review #2 — no source in `manifest-merge.ts`, `manifest-merge-overlay.ts`, `manifest-merge-base-images.ts`, or `manifest-merge-flag-prs.ts` was touched in this window. All remain ✅ (including the documented 3.1 stale-conflict hard-failure exception, and the 3.3 pagination fix from Review #1).

---

## 4. General / Cross-cutting

### 4.1–4.3, 4.5, 4.6

Unchanged since Review #2. Remain ✅.

### 4.4 S3 key structure is exact

- ✅ Manifests (single-package, or squashed by compare for monorepo): `manifests/{commit-sha}.json`
- ❌ Manifests (monorepo, written by generate per chunk): `manifests/{commit-sha}/{chunk-id}.json`, where `{chunk-id}` is the MD5 of the trimmed, sorted `package-paths` — _`manifest-generate.ts:91-93` uses the literal package path as the filename, not an MD5 chunk-id (see 1.4)_
- ✅ Changesets: `changesets/{pr-head-sha}.json`
- ✅ New images: `new-images/{commit-sha}/path/new.png`
- ✅ Base images: `base-images/path/base.png`
- ✅ `original-new-images/` is never written by any manifest mode

### 4.7 — removed

Review #2's only open finding. `action.yml` no longer defines `head-sha`, `base-ref`, `pr-sha`, `pr-number`, or `merge-commit-sha` (`action.yml` diff: `-15` lines, no replacements). Verified per mode:

- `manifest-generate` now resolves the base-branch HEAD live via `resolveBaseHeadSha` → `octokit.rest.repos.getBranch({ branch: pull_request.base.ref })` (`manifest-generate.ts:61-65, 106-115`), matching `manifest-compare`'s existing `getBranch`-based resolution. No baseline (e.g. non-PR trigger) falls back to uploading everything, per 1.2.
- `manifest-compare` (`manifest-run.ts:11-24`) and `manifest-merge` (`manifest-run.ts:67-84`) read `baseRef`/`prSha`/`mergeCommitSha`/`prNumber` exclusively from `githubContext.payload.pull_request`, `setFailed`-ing if the event payload lacks them, with no input fallback.

`MANIFEST_AC.md` deletes the criterion outright rather than marking it ✅ in place; the deletion is consistent with it being satisfied, so no discrepancy follows from that choice.

---

## Verdict

31 of 34 currently-defined criteria are satisfied. The one true code change since Review #2 — removing the five override inputs and deriving everything from the `pull_request` event — is correct and closes out 4.7 cleanly.

The three unsatisfied criteria (1.4, 1.5, and 4.4's chunk-id bullet) are not new code defects: the `manifest-generate` monorepo path is byte-for-byte what Review #2 already rated ✅, including its tests. What changed is `MANIFEST_AC.md` itself, redefining the monorepo contract from "one package per `manifest-generate` job, filename = literal package path" to "one or more packages per job (a chunk), filename = MD5 of the sorted package set." That rewrite (`f4796d2`, after `da406b5`) was not accompanied by an implementation update. Concretely, closing this gap requires:

1. Removing the `packagePaths.length > 1` rejection in `manifest-generate.ts:22-28`.
2. Hashing the trimmed/sorted/joined `package-paths` into a chunk-id (MD5, per `hash.ts`'s existing pattern) and using it as the manifest filename instead of the raw package path at `manifest-generate.ts:91-93`.
3. Iterating every package in the chunk when building `entries`/`manifest` (currently the loop only ever sees one `packagePath` value applied uniformly at `manifest-generate.ts:55`), so each screenshot is prefixed with the package subdirectory it actually lives under rather than a single job-wide path.
4. Updating `manifest-generate.test.ts:283` and `:291-299` (currently pinned to the single-package literal-filename behavior and to rejecting multi-package input) to match.

2.16's squash logic already tolerates either filename scheme, so no change is needed there.
