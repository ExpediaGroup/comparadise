import type { Changeset, Manifest } from './manifest-s3';
import type { ApplyBaseImagesParams } from './manifest-merge-base-images';
import type { FlagOverlappingPrsParams } from './manifest-merge-flag-prs';

export interface ManifestMergeDeps {
  getAncestorManifest: (bucket: string, startSha: string) => Promise<Manifest>;
  putManifest: (
    bucket: string,
    sha: string,
    manifest: Manifest
  ) => Promise<void>;
  getChangeset: (bucket: string, sha: string) => Promise<Changeset | null>;
  getMergeParentSha: (mergeCommitSha: string) => Promise<string>;
  flagOverlappingOpenPrs: (
    params: FlagOverlappingPrsParams
  ) => Promise<number[]>;
  applyChangesetToBaseImages: (params: ApplyBaseImagesParams) => Promise<void>;
  overlayChangeset: (parent: Manifest, changeset: Changeset) => Manifest;
  detectStaleConflicts: (
    head: Manifest,
    parent: Manifest,
    changeset: Changeset
  ) => string[];
  core: {
    info: (message: string) => void;
    setFailed: (message: string | Error) => void;
    warning: (message: string | Error) => void;
  };
}

export interface ManifestMergeParams {
  bucket: string;
  prNumber: number;
  prSha: string;
  mergeCommitSha: string;
  repo: { owner: string; repo: string };
}

export async function manifestMerge(
  params: ManifestMergeParams,
  deps: ManifestMergeDeps
): Promise<void> {
  const { bucket, prSha, mergeCommitSha } = params;

  const changeset = await deps.getChangeset(bucket, prSha);
  const parentSha = await deps.getMergeParentSha(mergeCommitSha);
  const parentManifest = await deps.getAncestorManifest(bucket, parentSha);

  if (!changeset) {
    deps.core.info(
      `No changeset found for PR ${prSha}; copying parent manifest unchanged.`
    );
    await deps.putManifest(bucket, mergeCommitSha, parentManifest);
    return;
  }

  await deps.flagOverlappingOpenPrs({
    bucket,
    repo: params.repo,
    mergingPrNumber: params.prNumber,
    mergingChangeset: changeset
  });

  if (changeset._headSha && changeset._headSha !== parentSha) {
    await assertNoStaleConflicts(deps, params, changeset, parentManifest);
  }

  const merged = deps.overlayChangeset(parentManifest, changeset);
  await deps.putManifest(bucket, mergeCommitSha, merged);
  await deps.applyChangesetToBaseImages({ bucket, prSha, changeset });
}

async function assertNoStaleConflicts(
  deps: ManifestMergeDeps,
  params: ManifestMergeParams,
  changeset: Changeset,
  parentManifest: Manifest
): Promise<void> {
  const headSha = changeset._headSha;
  if (!headSha) return;

  // The _headSha commit itself may have no manifest (its push didn't run
  // manifest-merge), so resolve via the nearest ancestor rather than treating
  // it as {} — which would flag every changeset path as a false conflict.
  const headManifest = await deps.getAncestorManifest(params.bucket, headSha);
  const conflicts = deps.detectStaleConflicts(
    headManifest,
    parentManifest,
    changeset
  );
  if (conflicts.length === 0) return;

  // Throw as the sole failure signal (see main.ts) — and critically, abort
  // before any manifest is written, since a manifest just declared conflicting
  // must not be published.
  throw new Error(
    `Stale changeset: ${conflicts.length} path(s) changed on main since this PR was compared (${conflicts.join(', ')}). The merging PR must be rebased and re-checked.`
  );
}
