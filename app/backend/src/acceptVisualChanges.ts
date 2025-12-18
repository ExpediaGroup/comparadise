import {
  BASE_IMAGE_NAME,
  BASE_IMAGES_DIRECTORY,
  NEW_IMAGE_NAME,
  NEW_IMAGES_DIRECTORY
} from 'shared';
import { findReasonToPreventVisualChangeAcceptance } from './findReasonToPreventVisualChangeAcceptance';
import { TRPCError } from '@trpc/server';
import { AcceptVisualChangesInput } from './schema';
import { getKeysFromS3 } from './getKeysFromS3';
import { updateCommitStatus } from './updateCommitStatus';
import { copyS3File } from './copyS3File';

export const acceptVisualChanges = async ({
  commitHash,
  diffId,
  useBaseImages,
  bucket,
  owner,
  repo
}: AcceptVisualChangesInput) => {
  const reasonToPreventUpdate =
    commitHash &&
    (await findReasonToPreventVisualChangeAcceptance(owner, repo, commitHash));
  if (reasonToPreventUpdate) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: reasonToPreventUpdate
    });
  }
  const hash = commitHash ?? diffId;
  if (!hash) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Please provide either a commitHash or a diffId.'
    });
  }

  if (useBaseImages) {
    const s3Paths = await getKeysFromS3(hash, bucket);
    await updateBaseImages(s3Paths, bucket);
  }
  if (commitHash) {
    await updateCommitStatus({ owner, repo, commitHash });
  }
};

export const filterNewImages = (s3Paths: string[]) => {
  return s3Paths.filter(path =>
    path.match(new RegExp(`/${NEW_IMAGE_NAME}.png`))
  );
};

export const getBaseImagePaths = (newImagePaths: string[]) => {
  return newImagePaths.map(path => {
    const commitHash = path.split('/')[1] ?? '';
    return path
      .replace(`${NEW_IMAGES_DIRECTORY}/${commitHash}`, BASE_IMAGES_DIRECTORY)
      .replace(`${NEW_IMAGE_NAME}.png`, `${BASE_IMAGE_NAME}.png`);
  });
};

export const updateBaseImages = async (s3Paths: string[], bucket: string) => {
  const newImagePaths = filterNewImages(s3Paths);
  const baseImagePaths = getBaseImagePaths(newImagePaths);
  return await Promise.all(
    baseImagePaths.map(async (path, index) => {
      const sourcePath = newImagePaths[index];
      if (!sourcePath) {
        throw new Error(`Source path not found for index ${index}`);
      }
      await copyS3File(sourcePath, path, bucket);
    })
  );
};
