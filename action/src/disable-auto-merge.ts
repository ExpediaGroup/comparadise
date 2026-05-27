import { context } from '@actions/github';
import type { Deps } from './deps';

export const disableAutoMerge = async (commitHash: string, deps: Deps) => {
  try {
    const { data } =
      await deps.octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        commit_sha: commitHash,
        ...context.repo
      });
    const pullRequest = data.find(Boolean);
    if (!pullRequest) {
      deps.core.warning(
        'Auto merge could not be disabled - could not find pull request from commit hash.'
      );
      return;
    }
    return await deps.octokit.graphql(`
    mutation {
      disablePullRequestAutoMerge(input: { pullRequestId: "${pullRequest.node_id}"}) {
        clientMutationId
      }
    }
  `);
  } catch (error) {
    deps.core.warning(
      'Auto merge could not be disabled, probably because it is disabled for this repo.'
    );
    deps.core.warning(error as Error);
  }
};
