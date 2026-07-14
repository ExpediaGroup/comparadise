# Manifest-Based Visual Comparison — Acceptance Criteria (Review #4)

This is `MANIFEST_AC.md` annotated with implementation status for PR [#786](https://github.com/ExpediaGroup/comparadise/pull/786).

Source-only review of `action/src/` at the PR head SHA `2e37cc9`, diffed against Review #3's SHA `24b8637`.

Each criterion is marked ✅ (satisfied), ❌ (not satisfied), or ⚠️ (satisfied with a caveat worth noting), with a reason for anything not plainly satisfied.

**Summary:** Since Review #3, a single implementation commit (`68bf536`) closes all three previously open criteria: **1.4, 1.5, and 4.4's chunk-id bullet**. `manifest-generate.ts` now accepts any number of packages per job, derives a chunk-id by sorting `package-paths`, joining with `,`, and MD5-hashing via `hashString` (`manifest-generate.ts:103-107`), and writes the manifest to `manifests/${commitHash}/${chunkId}.json`; the old `setFailed` guard rejecting multi-package input is removed. A second commit (`2e37cc9`) syncs the compiled `action/dist/` output. All 175 tests pass. **All 34 currently-defined criteria are satisfied.**

---

## 1. `manifest-generate` mode

### 1.1–1.3

Unchanged since Review #3. All remain ✅.

### 1.4 Monorepo — chunk manifest path

**Given** the `workflow` input is `manifest-generate` and `package-paths` is non-empty (one or more comma-separated packages — a "chunk")
**When** the manifest is written to S3
**Then**:

- ✅ A chunk identifier is derived deterministically from `package-paths`: the paths are trimmed, empties dropped, sorted, and joined, then MD5-hashed — _`chunkIdFor` (`manifest-generate.ts:103-107`) takes the already-trimmed/filtered `packagePaths` array, sorts a copy, joins with `,`, and calls `hashString` (which wraps `createHash('md5')` in `hash.ts`). Order-independence is confirmed by the test at `manifest-generate.test.ts:316-320`: input `'packages/ui,packages/core'` (reversed) yields `hashString('packages/core,packages/ui')` (sorted)._
- ✅ A single manifest is written to `manifests/{commit-sha}/{chunk-id}.json` — _`manifest-generate.ts:91-93` now computes `chunkId` and writes to `manifests/${commitHash}/${chunkId}.json` when `chunkId` is non-empty, or `manifests/${commitHash}.json` for the non-monorepo case._

### 1.5 Monorepo — multiple packages per job (chunk)

**Given** the `workflow` input is `manifest-generate` and `package-paths` lists more than one package
**When** the action runs
**Then**:

- ✅ The job is **not** rejected for listing multiple packages — _the `setFailed('manifest-generate expects a single package-paths value…')` guard at the old `manifest-generate.ts:22-28` is gone; no rejection on `packagePaths.length > 1` exists anywhere in the source. Asserted by `manifest-generate.test.ts:294-335` ("accepts multiple packages in a single job (a chunk) and writes one manifest"): `setFailedMock` is not called._
- ✅ Every screenshot under the screenshots root is included; each entry is keyed by its relative path as-is (no package prefix is added) — _the glob at `manifest-generate.ts:34-38` covers `${screenshotsDirectory}/**/new.png` unconditionally; each `key` is the on-disk relative path with `/${screenshotsDirectory}/` and `/new.png` stripped — no code adds a package prefix. For monorepos, the package prefix is already baked into the directory structure (e.g. `screenshots/packages/ui/Button/new.png` → key `packages/ui/Button`). Both packages are present in the manifest: `manifest-generate.test.ts:321-324` asserts `{ 'packages/ui/Button': 'hashUi', 'packages/core/Widget': 'hashCore' }`._
- ✅ All packages' entries are written to the single chunk manifest file defined in 1.4 — _`manifest-generate.test.ts:312-319` asserts exactly one `putObject` call under `manifests/` and that its key matches the MD5 chunk-id._
- ✅ Differential upload and resize behavior are otherwise identical to the single-package case — _the upload and resize paths are shared code downstream of the `chunkIdFor` call; no branch diverges for multi-package. `manifest-generate.test.ts:353-395` verifies the differential-upload path for a monorepo job (only the changed image is uploaded)._

---

## 2. `manifest-compare` mode

### 2.1–2.16

Unchanged since Review #3. All remain ✅ (including 2.16's `squashPrManifest` logic, which is agnostic to whether per-job manifest filenames are literal package paths or MD5 chunk-ids).

---

## 3. `manifest-merge` mode

### 3.1–3.10

Unchanged since Review #3. All remain ✅.

---

## 4. General / Cross-cutting

### 4.1–4.3, 4.5, 4.6

Unchanged since Review #3. All remain ✅.

### 4.4 S3 key structure is exact

- ✅ Manifests (single-package, or squashed by compare for monorepo): `manifests/{commit-sha}.json`
- ✅ Manifests (monorepo, written by generate per chunk): `manifests/{commit-sha}/{chunk-id}.json`, where `{chunk-id}` is the MD5 of the trimmed, sorted `package-paths` — _`manifest-generate.ts:91-93`; `action.yml`'s `package-paths` description and `docs/docs/setup/manifest-workflows.md` are both updated to match (`68bf536`)._
- ✅ Changesets: `changesets/{pr-head-sha}.json`
- ✅ New images: `new-images/{commit-sha}/path/new.png`
- ✅ Base images: `base-images/path/base.png`
- ✅ `original-new-images/` is never written by any manifest mode

---

## Verdict

All 34 currently-defined criteria are satisfied. The one implementation gap carried across Reviews #1–3 — the monorepo chunk model for `manifest-generate` (criteria 1.4, 1.5, 4.4's chunk-id bullet) — is now closed. Code, tests, `action.yml`, and docs are consistent on the chunk model. 175 tests pass with 0 failures.
