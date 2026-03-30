import { logEvent } from './logger';
import { updateBaseImages } from 'shared/s3';
import { findReasonToPreventVisualChangeAcceptance } from './findReasonToPreventVisualChangeAcceptance';
import { TRPCError } from '@trpc/server';
import { AcceptVisualChangesInput } from './schema';
import type { Context } from './context';
import { updateCommitStatus } from './updateCommitStatus';

export const acceptVisualChanges = async (
  {
    commitHash,
    diffId,
    useBaseImages,
    bucket,
    owner,
    repo
  }: AcceptVisualChangesInput,
  ctx: Context
) => {
  const reasonToPreventUpdate =
    commitHash &&
    (await findReasonToPreventVisualChangeAcceptance(owner, repo, commitHash));
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
    await updateBaseImages(hash, bucket);
  }
  if (commitHash) {
    await updateCommitStatus({ owner, repo, commitHash });
  }
  logEvent('INFO', {
    event: 'VISUAL_CHANGES_ACCEPTED',
    ...ctx.urlParams
  });
};
