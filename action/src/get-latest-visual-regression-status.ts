import { octokit } from './octokit';
import { context } from '@actions/github';
import { warning } from '@actions/core';
import { VISUAL_REGRESSION_CONTEXT } from 'shared';

export const getLatestVisualRegressionStatus = async (commitHash: string) => {
  try {
    const {data} = await octokit.rest.repos.listCommitStatusesForRef({
      ref: commitHash,
      ...context.repo
    });

    return data.find(status => status.context === VISUAL_REGRESSION_CONTEXT);
  } catch (error) {
    warning(
        'Failed to get latest visual regression status.'
    );
    warning(error as Error);
    return null;
  }
};
