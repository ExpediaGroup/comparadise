import { VISUAL_REGRESSION_CONTEXT } from 'shared/constants';
import type { Dependencies } from './dependencies';
import type { Changeset, Manifest } from './manifest-s3';

const HEAD_SHA_KEY = '_headSha';

export interface FlagOverlappingPrsDeps {
  octokit: Dependencies['octokit'];
  getChangeset: (bucket: string, sha: string) => Promise<Changeset | null>;
  getAncestorManifest: (bucket: string, startSha: string) => Promise<Manifest>;
  core: Pick<Dependencies['core'], 'info'>;
}

export interface FlagOverlappingPrsParams {
  bucket: string;
  repo: { owner: string; repo: string };
  mergingPrNumber: number;
  mergingChangeset: Changeset;
}

/**
 * Conflict prevention (manifest-merge step 4).
 *
 * Walk every open PR; for any whose own changeset overlaps with the merging
 * PR's changeset on at least one screenshot path, set a failure commit status
 * on that PR's head SHA so the author knows to rebase.
 *
 * Returns the list of PR numbers that were flagged.
 */
export async function flagOverlappingOpenPrs(
  params: FlagOverlappingPrsParams,
  deps: FlagOverlappingPrsDeps
): Promise<number[]> {
  const { bucket, repo, mergingPrNumber, mergingChangeset } = params;

  const mergingPaths = changesetPaths(mergingChangeset);
  if (mergingPaths.size === 0) return [];

  const openPrs = await deps.octokit.paginate(deps.octokit.rest.pulls.list, {
    ...repo,
    state: 'open'
  });

  const flagged: number[] = [];

  for (const pr of openPrs) {
    if (pr.number === mergingPrNumber) continue;

    const otherChangeset = await deps.getChangeset(bucket, pr.head.sha);
    if (!otherChangeset) continue;

    // A path only conflicts when the two changesets disagree on its value —
    // an open PR whose hash (or deletion) matches what just merged would not
    // clobber the new baseline, so it doesn't need a rebase.
    const overlapping = [...changesetPaths(otherChangeset)].filter(
      p => mergingPaths.has(p) && otherChangeset[p] !== mergingChangeset[p]
    );
    if (overlapping.length === 0) continue;

    const stale = await dropStackedPaths(
      deps,
      bucket,
      pr.number,
      otherChangeset,
      mergingChangeset,
      overlapping
    );
    if (stale.length === 0) continue;

    deps.core.info(
      `Flagging PR #${pr.number} as stale (overlapping paths: ${stale.join(', ')}).`
    );
    await deps.octokit.rest.repos.createCommitStatus({
      ...repo,
      sha: pr.head.sha,
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'failure',
      description: 'Visual comparison outdated — please rebase.'
    });
    flagged.push(pr.number);
  }

  return flagged;
}

async function dropStackedPaths(
  deps: FlagOverlappingPrsDeps,
  bucket: string,
  prNumber: number,
  otherChangeset: Changeset,
  mergingChangeset: Changeset,
  overlapping: string[]
): Promise<string[]> {
  const otherHeadSha = otherChangeset[HEAD_SHA_KEY];
  if (!otherHeadSha) return overlapping;

  const otherBaseline = await deps.getAncestorManifest(bucket, otherHeadSha);
  const stacked = overlapping.filter(
    p => (otherBaseline[p] ?? null) === mergingChangeset[p]
  );
  if (stacked.length === 0) return overlapping;

  deps.core.info(
    `PR #${prNumber} was compared against a baseline that already includes the merging changes for ${stacked.join(', ')} — not stale for those paths.`
  );
  const stackedPaths = new Set(stacked);
  return overlapping.filter(p => !stackedPaths.has(p));
}

function changesetPaths(changeset: Changeset): Set<string> {
  return new Set(Object.keys(changeset).filter(key => key !== HEAD_SHA_KEY));
}
