import { getOctokit } from './getOctokit';
import { VISUAL_REGRESSION_CONTEXT } from 'shared';
import { GetVisualRegressionStatusInput } from './schema';

export const getVisualRegressionStatus = async ({
  owner,
  repo,
  commitHash
}: GetVisualRegressionStatusInput) => {
  const octokit = getOctokit(owner, repo);
  const { data } = await octokit.rest.repos.listCommitStatusesForRef({
    owner,
    repo,
    ref: commitHash
  });
  const visualRegressionStatus = data.find(
    ({ context }) => context === VISUAL_REGRESSION_CONTEXT
  );
  return { isAlreadyUpdated: visualRegressionStatus?.state === 'success' };
};
