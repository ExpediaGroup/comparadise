# Plan: GitHub Merge Queue Support

## Context

GitHub's native merge queue runs checks for multiple queued PRs in parallel. Each queue position N gets a `head_sha` (combined merge commit for positions 1..N) and a `base_sha` (combined commit for 1..N-1). When Comparadise runs visual tests against `base-images/`, position N sees all of N-1's changes as apparent diffs too — making it impossible to gate on just N's own changes.

The solution splits the merge queue workflow into two jobs: Job 1 reuses the existing `pr` workflow but detects the `merge_group` event and skips commit status and PR comment. Job 2 (`merge-queue-diff`) waits for N-1's results, computes pixel-isolated diffs, and is solely responsible for setting the commit status and comment.

---

## Implementation

### 1. `shared/package.json` — add image diff dependencies

```json
"pixelmatch": "7.1.0",
"pngjs": "7.0.0"
```

devDependencies: `"@types/pngjs": "6.0.5"` (pixelmatch 7.x ships its own types).

### 2. New file: `shared/images.ts`

Extract the pixel diff helpers from `comparadise-utils/images.ts` into `shared/` so both `comparadise-utils` and the action can consume them without duplication.

Exports:

- `PIXELMATCH_OPTIONS` — `{ alpha: 0.3, threshold: 0.5, includeAA: false }`
- `alignImagesToSameSize(firstImage: PNG, secondImage: PNG): [PNG, PNG]`
- `getDiffPixels(base: Buffer, actual: Buffer): { diffPixels: number; diff: PNG }` — buffer-based variant (no file I/O), suitable for the action's in-memory use case

### 3. `comparadise-utils/images.ts` — simplify

Remove the duplicated helpers (`createImageResizer`, `fillSizeDifference`, `alignImagesToSameSize`, `PIXELMATCH_OPTIONS`) and import them from `shared/images.ts` instead. `getDiffPixels` in comparadise-utils keeps its file-path signature but delegates to `shared/images.ts` internally.

Remove `pixelmatch` and `pngjs` from `comparadise-utils/package.json` — they are now provided transitively via `shared`.

### 4. `action/package.json` — no image dep changes needed

`pixelmatch` and `pngjs` now live in `shared/`, which the action already depends on.

---

### 5. `action.yml` — updated workflow description only

Update the `workflow` input description to document the new `merge-queue-diff` value. No new input needed — `base_sha` is read directly from the GitHub Actions event context (`context.payload.merge_group.base_sha`) in `run.ts`.

---

### 6. New file: `action/src/wait-for-merge-queue-baseline.ts`

Determines whether N-1 produced baseline images to diff against. Returns `true` if isolated diffs should be computed, `false` if Job 2 should fall back to N's base-image comparisons from Job 1.

```typescript
export async function waitForMergeQueueBaseline(
  baseSha: string,
  bucketName: string,
  intervalMs = 30_000,
  timeoutMs = 30 * 60 * 1000
): Promise<boolean>;
```

**Logic:**

1. **One-time GHA check**: query `octokit.rest.actions.listWorkflowRunsForRepo({ head_sha: baseSha, event: 'merge_group' })`
   - **No runs found** → position 1 (`base_sha` is the target branch tip, no merge queue run was ever triggered) — return `false`
   - **Run found** → proceed to step 2
2. **Poll `getLatestVisualRegressionStatus(baseSha)`** every `intervalMs` until non-null; return `false` on timeout (fall back to base-image comparisons rather than failing)
   - **`success`** → N-1's tests passed, no diffs uploaded — return `false`
   - **`failure`** → N-1's tests failed to execute, no images uploaded — return `false`
   - **`pending`** → N-1 found diffs and uploaded images (`uploadAllImages` is called before `createCommitStatus` in `run.ts`, so images are guaranteed present) — return `true`
   - **timeout** → N-1's status unknown, return `false` (fall back to base-image comparisons)

When `false` is returned, `computeMergeQueueDiffs` is skipped. N's Job 1 already uploaded comparisons against `base-images/` to `new-images/{head_sha}/`, so Job 2 reads those existing keys unchanged and sets status/comment from them.

---

### 7. New file: `action/src/compute-merge-queue-diffs.ts`

Core of Job 2. Lists `new.png` keys under `new-images/{baseSha}/` and `new-images/{headSha}/`, finds the intersection (tests where both PRs produced a `new.png`), runs pixelmatch on each, and overwrites those tests' `base.png` and `diff.png` in S3.

```typescript
export interface MergeQueueDiffResult {
  intersectionCount: number;
  diffCount: number;
}

export async function computeMergeQueueDiffs(
  headSha: string,
  baseSha: string,
  bucketName: string
): Promise<MergeQueueDiffResult>;
```

**Key details:**

- Import `getDiffPixels` and `alignImagesToSameSize` from `shared/images.ts`
- For each intersecting test path, download both `new.png` buffers via async iteration of the S3 `Readable` body (no disk writes)
- Overwrite `new-images/{headSha}/{testDir}/base.png` with N-1's `new.png` buffer
- Overwrite `new-images/{headSha}/{testDir}/diff.png` with pixelmatch output (`PNG.sync.write(diff)`)
- Leave `new-images/{headSha}/{testDir}/new.png` untouched (N's actual render)
- Return `{ intersectionCount, diffCount }` where `diffCount` = tests with >0 diff pixels

---

### 8. `action/src/run.ts` — `pr` branch guard + new `merge-queue-diff` branch

Add imports:

```typescript
import { waitForMergeQueueBaseline } from './wait-for-merge-queue-baseline';
import { computeMergeQueueDiffs } from './compute-merge-queue-diffs';
import { getKeysFromS3 } from 'shared/s3';
```

**`pr` branch change** — extend the existing `if (!commitHash) return` guard clauses to also bail on merge queue events:

```typescript
if (!commitHash || context.eventName === 'merge_group') return;
```

Every GitHub API call in the `pr` branch is already guarded by `if (!commitHash)` — this is a minimal diff, just adding `|| context.eventName === 'merge_group'` to those existing conditions. `setFailed` calls for test execution failures are not gated — those should still fail the job regardless.

**`merge-queue-diff` branch** (after the `merge` branch):

```typescript
if (workflow === 'merge-queue-diff') {
  const bucketName = getInput('bucket-name', { required: true });
  const baseSha = context.payload.merge_group?.base_sha;
  if (!baseSha) {
    setFailed('merge-queue-diff workflow requires a merge_group event context.');
    return;
  }

  const shouldComputeDiffs = await waitForMergeQueueBaseline(baseSha, bucketName);
  if (shouldComputeDiffs) {
    await computeMergeQueueDiffs(hash, baseSha, bucketName);
  }

  // Count all keys in new-images/{headSha}/ to determine final status
  const allHeadKeys = await getKeysFromS3(NEW_IMAGES_DIRECTORY, hash, bucketName);
  const totalDiffCount = allHeadKeys.filter(k => k.endsWith('/diff.png')).length;
  const totalNewCount  = allHeadKeys.filter(k => k.endsWith('/new.png')).length;

  if (!commitHash) return;

  if (totalDiffCount === 0 && totalNewCount === 0) {
    return octokit.rest.repos.createCommitStatus({ state: 'success', ... });
  }

  await octokit.rest.repos.createCommitStatus({ state: 'pending', ... });

  if (getBooleanInput('visual-test-command-fails-on-diff') && totalDiffCount > 0) {
    setFailed(pendingDescription);
  } else {
    warning(pendingDescription);
  }
  return;
}
```

---

## Files Modified

| File                                          | Change                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `shared/package.json`                         | Add pixelmatch, pngjs, @types/pngjs                                               |
| `shared/images.ts`                            | **New** — shared pixel diff helpers                                               |
| `comparadise-utils/images.ts`                 | Import from `shared/images.ts`, remove duplicated helpers                         |
| `comparadise-utils/package.json`              | Remove pixelmatch, pngjs (now via shared)                                         |
| `action.yml`                                  | Update `workflow` description only                                                |
| `action/src/run.ts`                           | Guard `pr` branch GitHub calls with `isMergeQueue`, add `merge-queue-diff` branch |
| `action/src/wait-for-merge-queue-baseline.ts` | **New** — GHA check + commit status poll                                          |
| `action/src/compute-merge-queue-diffs.ts`     | **New** — pixelmatch diff engine                                                  |

---

## Tests

**`shared/images.ts`**: Test `getDiffPixels` with identical buffers → `diffPixels: 0`, different buffers → `diffPixels > 0`, size-mismatched buffers → alignment applied without error.

**`wait-for-merge-queue-baseline`**: Mock `octokit.rest.actions.listWorkflowRunsForRepo` and `getLatestVisualRegressionStatus`. Test cases:

- No GHA run found → returns `false` immediately (position 1)
- Run found, status `success` → returns `false`
- Run found, status `failure` → returns `false`
- Run found, status `pending` → returns `true`
- Run found, status null then `pending` → polls until non-null, returns `true`
- Timeout → returns `false` (falls back gracefully); pass short `intervalMs`/`timeoutMs`

**`compute-merge-queue-diffs`**: Mock `listAllObjects`, `getObject`, `putObject` from `shared/s3`; mock `shared/images`. Test: empty intersection → no uploads, intersection with 0 diff pixels → two uploads + `diffCount: 0`, intersection with diff pixels → `diffCount: 1`, size mismatch → alignment runs without error.

**`pr` branch (merge_group event)**: Assert `createCommitStatus` and `createGithubComment` are NOT called when `context.eventName === 'merge_group'`, even when diffs are found. Assert `setFailed` IS still called when tests fail to execute.

**`merge-queue-diff` branch**: Assert `waitForMergeQueueBaseline` called with `baseSha` + bucket. Assert `computeMergeQueueDiffs` called when baseline returns `true`, skipped when `false`. Assert `success` status when no keys, `pending` status when diffs found. Assert `createGithubComment` is NOT called. Assert `setFailed` vs `warning` based on `visual-test-command-fails-on-diff`.

---

## Verification

1. `bunx nx test action` — all existing + new tests pass
2. `bunx nx test comparadise-utils` — existing tests still pass after refactor
3. `bun lint && bun format-check && bun tsc` — no errors
4. `bunx nx build action` — rebuilds `action/dist/` (required before commit)

**Example consumer workflow:**

```yaml
jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: your-org/comparadise@main
        with:
          workflow: pr # skips status/comment when event is merge_group
          commit-hash: ${{ github.event.merge_group.head_sha }}
          bucket-name: my-bucket
          visual-test-command: bun test:visual

  visual-diff:
    needs: visual-tests
    runs-on: ubuntu-latest
    steps:
      - uses: your-org/comparadise@main
        with:
          workflow: merge-queue-diff
          commit-hash: ${{ github.event.merge_group.head_sha }}
          bucket-name: my-bucket
          # base_sha is read automatically from github.event.merge_group.base_sha
```
