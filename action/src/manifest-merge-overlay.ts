import type { Changeset, Manifest } from './manifest-s3';

const HEAD_SHA_KEY = '_headSha';

/**
 * Apply a changeset to a parent manifest:
 *   - non-null entries: set/update hash
 *   - null entries: remove the key
 *
 * The `_headSha` metadata field is ignored. The parent manifest is not mutated.
 */
export function overlayChangeset(
  parent: Manifest,
  changeset: Changeset
): Manifest {
  const result: Manifest = { ...parent };
  for (const [path, hash] of Object.entries(changeset)) {
    if (path === HEAD_SHA_KEY) continue;
    if (hash === null) {
      delete result[path];
    } else {
      result[path] = hash;
    }
  }
  return result;
}

/**
 * Detect whether the merge target's manifest has drifted from the manifest the
 * changeset was computed against, on any path the changeset touches.
 *
 * Used as a safeguard at merge time when a changeset's `_headSha` differs from
 * the actual merge parent. A path conflicts when it drifted between the two
 * manifests *and* the changeset would write something other than what the merge
 * target already holds — otherwise applying it cannot clobber the intervening
 * change.
 *
 * Returns the list of conflicting paths (excluding the `_headSha` metadata).
 */
export function detectStaleConflicts(
  headManifest: Manifest,
  parentManifest: Manifest,
  changeset: Changeset
): string[] {
  const conflicts: string[] = [];
  for (const path of Object.keys(changeset)) {
    if (path === HEAD_SHA_KEY) continue;
    // The PR deletes this path and it is already absent from the merge target
    // (main deleted it too). Both sides agree on removal, so there is nothing
    // to clobber — not a conflict.
    if (changeset[path] === null && !(path in parentManifest)) continue;
    // The PR writes exactly what the merge target already holds, so the overlay
    // is a no-op. Main drifted, but it converged on the same hash — there is
    // nothing to clobber, so this must not force an unnecessary rebase.
    if (changeset[path] === parentManifest[path]) continue;
    if (headManifest[path] !== parentManifest[path]) {
      conflicts.push(path);
    }
  }
  return conflicts;
}
