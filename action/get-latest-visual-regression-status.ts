import { octokit } from './octokit';
import { context } from '@actions/github';

export const getLatestVisualRegressionStatus = async (commitHash: string) => {
  const { data } = await octokit.rest.repos.listCommitStatusesForRef({
    ref: commitHash,
    ...context.repo
  });

  return data.find(status => status.context === 'Visual Regression');
};
