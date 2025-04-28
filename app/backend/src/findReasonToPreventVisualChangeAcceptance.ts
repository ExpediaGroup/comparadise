import { getOctokit } from './getOctokit';
import { groupBy, isEqual, sortBy } from 'lodash';
import {
  VISUAL_REGRESSION_CONTEXT,
  VISUAL_TESTS_FAILED_TO_EXECUTE
} from 'shared';

export const findReasonToPreventVisualChangeAcceptance = async (
  owner: string,
  repo: string,
  sha: string
) => {
  const octokit = getOctokit(owner, repo);

  const { data } = await octokit.rest.repos.listCommitStatusesForRef({
    owner,
    repo,
    ref: sha
  });
  const visualRegressionContextDescription = data.find(
    ({ context }) => context === VISUAL_REGRESSION_CONTEXT
  )?.description;
  if (visualRegressionContextDescription === VISUAL_TESTS_FAILED_TO_EXECUTE)
    return 'At least one visual test job failed to take a screenshot. All jobs must take a screenshot before reviewing and updating base images!';
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
  const nonVisualChecksThatHaveNotPassed = mostRecentNonVisualStatuses
    .filter(({ state }) => state !== 'success')
    .map(({ context }) => context);
  if (nonVisualChecksThatHaveNotPassed.length) {
    return `All other PR checks must pass before updating base images! These checks have not passed on your PR: ${nonVisualChecksThatHaveNotPassed.join(
      ', '
    )}`;
  }
};
