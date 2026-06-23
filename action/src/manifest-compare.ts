import type {
  ClassifyParams,
  CompareResult,
  PrOwnsEntry
} from './manifest-compare-classify';
import type { GenerateDiffsParams } from './manifest-diff';
import type { Changeset, Manifest } from './manifest-s3';
import { VISUAL_REGRESSION_CONTEXT } from 'shared/constants';

export interface SetCommitStatusParams {
  sha: string;
  state: 'success' | 'pending' | 'failure';
  description: string;
  context: string;
  target_url?: string;
}

export type CommentArgs =
  | { kind: 'diffs'; commitHash: string; prOwns: PrOwnsEntry[] }
  | { kind: 'conflict'; commitHash: string; conflicts: string[] };

export interface ManifestCompareDeps {
  squashPrManifest: (bucket: string, sha: string) => Promise<unknown>;
  classify: (params: ClassifyParams) => Promise<CompareResult>;
  generateDiffs: (params: GenerateDiffsParams) => Promise<void>;
  putChangeset: (
    bucket: string,
    sha: string,
    changeset: Changeset
  ) => Promise<void>;
  getPrManifest: (bucket: string, sha: string) => Promise<Manifest | null>;
  setCommitStatus: (params: SetCommitStatusParams) => Promise<void>;
  postComment: (args: CommentArgs) => Promise<void>;
  buildComparadiseUrl: () => string;
  core: {
    info: (message: string) => void;
    setFailed: (message: string | Error) => void;
    warning: (message: string | Error) => void;
  };
}

export interface ManifestCompareParams {
  bucket: string;
  prSha: string;
  repo: { owner: string; repo: string };
  baseRef: string;
}

export async function manifestCompare(
  params: ManifestCompareParams,
  deps: ManifestCompareDeps
): Promise<void> {
  const { bucket, prSha, repo, baseRef } = params;

  // Monorepo matrix jobs each write a per-package manifest under
  // manifests/{prSha}/. Squash them into the single manifests/{prSha}.json
  // before comparing; a no-op for single-package PRs (nothing to squash).
  await deps.squashPrManifest(bucket, prSha);

  const result = await deps.classify({ bucket, prSha, repo, baseRef });

  if (result.outcome === 'match') {
    deps.core.info('Visual manifests match — no changes detected.');
    await deps.setCommitStatus({
      sha: prSha,
      state: 'success',
      description: 'Visual tests passed!',
      context: VISUAL_REGRESSION_CONTEXT
    });
    return;
  }

  if (result.conflicts.length > 0) {
    await handleConflicts(deps, prSha, result.conflicts);
    return;
  }

  if (result.prOwns.length === 0) {
    deps.core.info(
      `Visual changes on main only (${result.mainOwns.length} path(s)) — PR is clean.`
    );
    await deps.setCommitStatus({
      sha: prSha,
      state: 'success',
      description: 'Visual tests passed!',
      context: VISUAL_REGRESSION_CONTEXT
    });
    return;
  }

  await handlePrOwns(deps, params, result);
}

async function handleConflicts(
  deps: ManifestCompareDeps,
  prSha: string,
  conflicts: string[]
): Promise<void> {
  deps.core.setFailed(
    `Visual diff conflicts detected on ${conflicts.length} screenshot(s). Please rebase.`
  );
  await deps.setCommitStatus({
    sha: prSha,
    state: 'failure',
    description: 'Visual diff conflicts — please rebase.',
    context: VISUAL_REGRESSION_CONTEXT
  });
  await deps.postComment({
    kind: 'conflict',
    commitHash: prSha,
    conflicts
  });
}

async function handlePrOwns(
  deps: ManifestCompareDeps,
  params: ManifestCompareParams,
  result: Extract<CompareResult, { outcome: 'classified' }>
): Promise<void> {
  const { bucket, prSha } = params;

  const reviewable = result.prOwns.filter(e => e.type !== 'deleted');
  const deletions = result.prOwns.filter(e => e.type === 'deleted');

  if (deletions.length > 0) {
    deps.core.info(`${deletions.length} screenshot(s) deleted by this PR.`);
  }

  const prManifest = (await deps.getPrManifest(bucket, prSha)) ?? {};
  const changeset = buildChangeset(result.headSha, result.prOwns, prManifest);
  await deps.putChangeset(bucket, prSha, changeset);

  if (reviewable.length === 0) {
    deps.core.info(
      'No visual changes to review (deletions only) — marking success.'
    );
    await deps.setCommitStatus({
      sha: prSha,
      state: 'success',
      description: 'Visual tests passed!',
      context: VISUAL_REGRESSION_CONTEXT
    });
    return;
  }

  await deps.generateDiffs({ bucket, prSha, prOwns: reviewable });

  await deps.setCommitStatus({
    sha: prSha,
    state: 'pending',
    description: 'Visual diffs found.',
    context: VISUAL_REGRESSION_CONTEXT,
    target_url: deps.buildComparadiseUrl()
  });

  await deps.postComment({
    kind: 'diffs',
    commitHash: prSha,
    prOwns: reviewable
  });
}

function buildChangeset(
  headSha: string,
  prOwns: PrOwnsEntry[],
  prManifest: Manifest
): Changeset {
  const changeset: Changeset = { _headSha: headSha };
  for (const entry of prOwns) {
    if (entry.type === 'deleted') {
      changeset[entry.path] = null;
    } else {
      const hash = prManifest[entry.path];
      if (!hash) {
        throw new Error(
          `PR manifest is missing hash for ${entry.path} (type: ${entry.type})`
        );
      }
      changeset[entry.path] = hash;
    }
  }
  return changeset;
}
