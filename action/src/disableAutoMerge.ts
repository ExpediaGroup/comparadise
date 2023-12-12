import { octokit } from './octokit';
import { warning } from '@actions/core';
import { context } from '@actions/github';

export const disableAutoMerge = async (mergeMethod = 'SQUASH') => {
  try {
    const { data: pullRequest } = await octokit.rest.pulls.get({
      pull_number: context.issue.number,
      ...context.repo
    });
    return await octokit.graphql(`
    mutation {
      disablePullRequestAutoMerge(input: { pullRequestId: "${pullRequest.node_id}", mergeMethod: ${mergeMethod} }) {
        clientMutationId
      }
    }
  `);
  } catch (error) {
    warning(
      'Auto merge could not be disabled, probably because it is disabled for this repo.'
    );
    warning(error as Error);
  }
};
