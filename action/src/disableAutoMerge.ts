import { octokit } from './octokit';
import { warning } from '@actions/core';
import { context } from '@actions/github';

export const disableAutoMerge = async (
  commitHash: string,
  mergeMethod = 'SQUASH'
) => {
  try {
    const { data } =
      await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        commit_sha: commitHash,
        ...context.repo
      });
    const pullRequest = data.find(Boolean);
    if (!pullRequest) {
      warning(
        'Auto merge could not be disabled - could not find pull request from commit hash.'
      );
      return;
    }
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
