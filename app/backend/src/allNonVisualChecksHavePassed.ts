import { getOctokit } from './getOctokit';
import { groupBy, isEqual, sortBy } from 'lodash';
import { VISUAL_REGRESSION_CONTEXT } from 'shared';

export const allNonVisualChecksHavePassed = async (
  owner: string,
  repo: string,
  sha: string
): Promise<boolean> => {
  const octokit = getOctokit(owner, repo);

  const { data } = await octokit.rest.repos.listCommitStatusesForRef({
    owner,
    repo,
    ref: sha,
  });
  const nonVisualStatuses = data.filter(
    ({ context }) => context !== VISUAL_REGRESSION_CONTEXT
  );
  const groupedNonVisualStatuses = groupBy(nonVisualStatuses, 'context');
  const mostRecentNonVisualStatuses = nonVisualStatuses.filter(status => {
    const contextsSortedByDescTime = sortBy(
      groupedNonVisualStatuses[status.context],
      'created_at'
    ).reverse();
    return isEqual(status, contextsSortedByDescTime.find(Boolean));
  });
  return mostRecentNonVisualStatuses.every(({ state }) => state === 'success');
};
