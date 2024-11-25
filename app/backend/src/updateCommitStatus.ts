import { TRPCError } from '@trpc/server';
import { UpdateGitStatus } from './schema';
import { getOctokit } from './getOctokit';
import { VISUAL_REGRESSION_CONTEXT } from 'shared';

export const updateCommitStatus = async ({
  owner,
  repo,
  commitHash
}: UpdateGitStatus) => {
  const octokit = getOctokit(owner, repo);
  return octokit.rest.repos
    .createCommitStatus({
      owner,
      repo,
      sha: commitHash,
      state: 'success',
      description: 'Base images updated successfully.',
      context: VISUAL_REGRESSION_CONTEXT
    })
    .catch(error => {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to update GitHub commit status: ${error}`
      });
    });
};
