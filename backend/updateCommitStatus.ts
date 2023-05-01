import { TRPCError } from '@trpc/server';
import {getOctokit} from "./getOctokit";
import {VISUAL_REGRESSION_STATUS_NAME} from "./constants";
import {UpdateCommitStatusInput} from "./schema";

export const updateCommitStatus = async ({owner, repo, hash}: UpdateCommitStatusInput) => {
  const octokit = getOctokit(owner, repo);
  return octokit.rest.repos
    .createCommitStatus({
      owner,
      repo,
      sha: hash,
      state: 'success',
      description: 'Your visual tests have passed.',
      context: VISUAL_REGRESSION_STATUS_NAME
    })
    .catch(error => {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to update GitHub commit status: ${error}`
      });
    });
};
