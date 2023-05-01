import { TRPCError } from '@trpc/server';
import { UpdateCommitStatusInput } from './schema';
import { getOctokit } from './getOctokit';

export const updateCommitStatus = async ({ owner, repo, hash }: UpdateCommitStatusInput) => {
  const octokit = getOctokit(owner, repo);
  return octokit.rest.repos
    .createCommitStatus({
      owner,
      repo,
      sha: hash,
      state: 'success',
      description: 'Your visual tests have passed.',
      context: 'Visual Regression'
    })
    .catch(error => {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to update GitHub commit status: ${error}`
      });
    });
};
