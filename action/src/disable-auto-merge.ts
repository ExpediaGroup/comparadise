import type { Dependencies } from './dependencies';

export const disableAutoMerge = async (
  commitHash: string,
  deps: Dependencies
) => {
  try {
    const { data } =
      await deps.octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        commit_sha: commitHash,
        ...deps.context.repo
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
