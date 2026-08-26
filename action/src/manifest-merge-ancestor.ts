import type { Manifest } from './manifest-s3';

export interface FindAncestorManifestDeps {
  getManifest: (bucket: string, sha: string) => Promise<Manifest | null>;
  getParentSha: (sha: string) => Promise<string | null>;
  core: { warning: (message: string | Error) => void };
}

// A hop count high enough to bridge any realistic run of commits that skip
// manifest-merge (e.g. several ci-only pushes in a row), but bounded so a
// genuinely history-less bootstrap doesn't walk the entire repo commit-by-commit.
const MAX_WALK_DEPTH = 100;

/**
 * Resolve the manifest to use as a merge base starting at `startSha`.
 *
 * A merge commit's *direct* git parent doesn't always have a manifest of its
 * own — e.g. its push didn't touch any comparadise-relevant path, so
 * manifest-merge never ran for it, or it had no PR associated with it. Rather
 * than treating that single missing lookup as "no manifest ever existed" and
 * collapsing to `{}` (silently forgetting every previously merged baseline
 * hash), walk back through ancestor commits until one with a manifest is
 * found.
 *
 * Returns `{}` if no ancestor within MAX_WALK_DEPTH hops has a manifest —
 * covering both the true bootstrap case (no manifest has ever been merged)
 * and, with a warning, an unexpectedly large gap.
 */
export async function findAncestorManifest(
  bucket: string,
  startSha: string,
  deps: FindAncestorManifestDeps
): Promise<Manifest> {
  let sha: string | null = startSha;
  for (let hops = 0; sha && hops < MAX_WALK_DEPTH; hops++) {
    const manifest = await deps.getManifest(bucket, sha);
    if (manifest) return manifest;
    sha = await deps.getParentSha(sha);
  }

  if (sha) {
    deps.core.warning(
      `No manifest found within ${MAX_WALK_DEPTH} commit(s) of ${startSha}; ` +
        'treating as empty. This may indicate a much larger-than-expected gap ' +
        'in manifest-merge history.'
    );
  }

  return {};
}
