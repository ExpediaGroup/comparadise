import { logEvent } from './logger';
import {
  copyNewImagesToBase,
  copyS3Object,
  filterNewImages,
  toBaseImagePath,
  NEW_IMAGES_DIRECTORY,
  ORIGINAL_NEW_IMAGES_DIRECTORY
} from 'shared';
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
    await copyNewImagesToBase(hash, bucket, 'bucket-owner-full-control');
  }
  if (commitHash) {
    await updateCommitStatus({ owner, repo, commitHash });
  }
  logEvent('INFO', {
    event: 'VISUAL_CHANGES_ACCEPTED',
    ...ctx.urlParams
  });
};

export { filterNewImages, toBaseImagePath };

export const getBaseImagePaths = (newImagePaths: string[]) => {
  const hash = newImagePaths[0]?.split('/')[1] ?? '';
  return filterNewImages(newImagePaths).map(p =>
    toBaseImagePath(p, NEW_IMAGES_DIRECTORY, hash)
  );
};

export const getBaseImagePathsFromOriginal = (
  originalNewImagePaths: string[]
) => {
  const hash = originalNewImagePaths[0]?.split('/')[1] ?? '';
  return filterNewImages(originalNewImagePaths).map(p =>
    toBaseImagePath(p, ORIGINAL_NEW_IMAGES_DIRECTORY, hash)
  );
};

export const updateBaseImages = async (s3Paths: string[], bucket: string) => {
  const newImagePaths = filterNewImages(s3Paths);
  const hash = newImagePaths[0]?.split('/')[1] ?? '';
  await Promise.all(
    newImagePaths.map(key =>
      copyS3Object(
        bucket,
        key,
        toBaseImagePath(key, NEW_IMAGES_DIRECTORY, hash),
        'bucket-owner-full-control'
      )
    )
  );
};
