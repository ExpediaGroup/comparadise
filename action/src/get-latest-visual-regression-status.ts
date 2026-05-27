import { VISUAL_REGRESSION_CONTEXT } from 'shared/constants';
import type { Dependencies, Octokit } from './dependencies';

export const getLatestVisualRegressionStatus = async (
  commitHash: string,
  octokit: Octokit,
  context: Dependencies['context']
) => {
  const { data } = await octokit.rest.repos.listCommitStatusesForRef({
    ref: commitHash,
    ...context.repo
  });

  return data.find(status => status.context === VISUAL_REGRESSION_CONTEXT);
};
