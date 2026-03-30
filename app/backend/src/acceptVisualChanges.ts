import { logEvent } from './logger';
import {
  copyObject,
  encodeS3CopySource,
  filterNewImages,
  toBaseImagePath,
  BASE_IMAGES_DIRECTORY,
  NEW_IMAGES_DIRECTORY,
  ORIGINAL_NEW_IMAGES_DIRECTORY
} from 'shared';
import { findReasonToPreventVisualChangeAcceptance } from './findReasonToPreventVisualChangeAcceptance';
import { TRPCError } from '@trpc/server';
import { AcceptVisualChangesInput } from './schema';
import type { Context } from './context';
import { getKeysFromS3 } from './getKeysFromS3';
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
    const originalNewImagePaths = await getKeysFromS3(
      ORIGINAL_NEW_IMAGES_DIRECTORY,
      hash,
      bucket
    );
    if (originalNewImagePaths.length > 0) {
      await updateBaseImagesFromOriginal(originalNewImagePaths, bucket);
    } else {
      const s3Paths = await getKeysFromS3(NEW_IMAGES_DIRECTORY, hash, bucket);
      await updateBaseImages(s3Paths, bucket);
    }
  }
  if (commitHash) {
    await updateCommitStatus({ owner, repo, commitHash });
  }
  logEvent('INFO', {
    event: 'VISUAL_CHANGES_ACCEPTED',
    ...ctx.urlParams
  });
};

export { filterNewImages };

function toBaseImagePaths(paths: string[], sourceDirectory: string) {
  return paths.map(path => {
    const commitHash = path.split('/')[1] ?? '';
    return toBaseImagePath(path, sourceDirectory, commitHash);
  });
}

export const getBaseImagePaths = (newImagePaths: string[]) =>
  toBaseImagePaths(newImagePaths, NEW_IMAGES_DIRECTORY);

async function copyImages(
  sourcePaths: string[],
  destPaths: string[],
  bucket: string
): Promise<void> {
  await Promise.all(
    destPaths.map(async (path, index) => {
      const copySource = sourcePaths[index];
      if (!copySource) {
        throw new Error(`Source path not found for index ${index}`);
      }
      await copyObject({
        Bucket: bucket,
        CopySource: encodeS3CopySource(bucket, copySource),
        Key: path,
        ACL: 'bucket-owner-full-control'
      });
    })
  );
}

export const updateBaseImages = async (s3Paths: string[], bucket: string) => {
  const newImagePaths = filterNewImages(s3Paths);
  const baseImagePaths = getBaseImagePaths(newImagePaths);
  return copyImages(newImagePaths, baseImagePaths, bucket);
};

export const getBaseImagePathsFromOriginal = (
  originalNewImagePaths: string[]
) => toBaseImagePaths(originalNewImagePaths, ORIGINAL_NEW_IMAGES_DIRECTORY);

export const updateBaseImagesFromOriginal = async (
  originalPaths: string[],
  bucket: string
) => {
  const newImagePaths = filterNewImages(originalPaths);
  const baseImagePaths = getBaseImagePathsFromOriginal(newImagePaths);
  return copyImages(newImagePaths, baseImagePaths, bucket);
};
