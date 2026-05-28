import { VISUAL_REGRESSION_CONTEXT } from 'shared/constants';
import type { Dependencies } from './dependencies';
import type { Changeset } from './manifest-s3';

const HEAD_SHA_KEY = '_headSha';

export interface FlagOverlappingPrsDeps {
  octokit: Dependencies['octokit'];
  getChangeset: (bucket: string, sha: string) => Promise<Changeset | null>;
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

  const { data: openPrs } = await deps.octokit.rest.pulls.list({
    ...repo,
    state: 'open'
  });

  const flagged: number[] = [];

  for (const pr of openPrs) {
    if (pr.number === mergingPrNumber) continue;

    const otherChangeset = await deps.getChangeset(bucket, pr.head.sha);
    if (!otherChangeset) continue;

    const overlapping = [...changesetPaths(otherChangeset)].filter(p =>
      mergingPaths.has(p)
    );
    if (overlapping.length === 0) continue;

    deps.core.info(
      `Flagging PR #${pr.number} as stale (overlapping paths: ${overlapping.join(', ')}).`
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

function changesetPaths(changeset: Changeset): Set<string> {
  return new Set(Object.keys(changeset).filter(key => key !== HEAD_SHA_KEY));
}
