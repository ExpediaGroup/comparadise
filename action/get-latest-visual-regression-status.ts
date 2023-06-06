import { octokit } from './octokit';
import { context } from '@actions/github';
import { VISUAL_REGRESSION_CONTEXT } from 'comparadise-shared';

export const getLatestVisualRegressionStatus = async (commitHash: string) => {
  const { data } = await octokit.rest.repos.listCommitStatusesForRef({
    ref: commitHash,
    ...context.repo
  });

  return data.find(status => status.context === VISUAL_REGRESSION_CONTEXT);
};
