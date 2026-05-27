import { logEvent } from './logger';
import { findReasonToPreventVisualChangeAcceptance } from './findReasonToPreventVisualChangeAcceptance';
import { TRPCError } from '@trpc/server';
import { AcceptVisualChangesInput } from './schema';
import type { Context } from './context';
import { getOctokit } from './getOctokit';
import * as defaultS3 from 'shared/s3';
import type { S3Operations } from 'shared/s3';
import { VISUAL_REGRESSION_CONTEXT } from 'shared/constants';
import type { Octokit } from '@octokit/rest';

export const acceptVisualChanges = async (
  {
    commitHash,
    diffId,
    useBaseImages,
    bucket,
    owner,
    repo
  }: AcceptVisualChangesInput,
  ctx: Context,
  s3: Pick<S3Operations, 'updateBaseImages'> = defaultS3,
  octokit: Octokit = getOctokit(owner, repo)
) => {
  const reasonToPreventUpdate =
    commitHash &&
    (await findReasonToPreventVisualChangeAcceptance(
      owner,
      repo,
      commitHash,
      useBaseImages,
      octokit
    ));
  if (reasonToPreventUpdate) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: reasonToPreventUpdate,
      cause: { event: 'VISUAL_CHANGE_ACCEPTANCE_BLOCKED' }
    });
  }
  const hash = commitHash ?? diffId;
  if (!hash) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Please provide either a commitHash or a diffId.',
      cause: { event: 'MISSING_IDENTIFIER' }
    });
  }

  if (useBaseImages) {
    await s3.updateBaseImages(hash, bucket);
  }
  if (commitHash) {
    await updateCommitStatus(owner, repo, commitHash, octokit);
  }
  logEvent('INFO', {
    event: 'VISUAL_CHANGES_ACCEPTED',
    ...ctx.urlParams
  });
};

async function updateCommitStatus(
  owner: string,
  repo: string,
  commitHash: string,
  octokit: Octokit
) {
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
        message: `Failed to update GitHub commit status: ${error}`,
        cause: { event: 'COMMIT_STATUS_UPDATE_FAILED' }
      });
    });
}
