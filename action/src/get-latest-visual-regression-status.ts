import { context } from '@actions/github';
import { VISUAL_REGRESSION_CONTEXT } from 'shared/constants';
import type { Octokit } from './deps';

export const getLatestVisualRegressionStatus = async (
  commitHash: string,
  octokit: Octokit
) => {
  const { data } = await octokit.rest.repos.listCommitStatusesForRef({
    ref: commitHash,
    ...context.repo
  });

  return data.find(status => status.context === VISUAL_REGRESSION_CONTEXT);
};
