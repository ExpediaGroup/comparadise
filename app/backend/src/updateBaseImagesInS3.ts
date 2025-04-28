import { S3Client } from './s3Client';
import {
  BASE_IMAGE_NAME,
  BASE_IMAGES_DIRECTORY,
  NEW_IMAGE_NAME,
  NEW_IMAGES_DIRECTORY
} from 'shared';
import { findReasonToPreventBaseImageUpdate } from './findReasonToPreventBaseImageUpdate';
import { TRPCError } from '@trpc/server';
import { AcceptVisualChangesInput } from './schema';
import { getKeysFromS3 } from './getKeysFromS3';
import { updateCommitStatus } from './updateCommitStatus';

export const updateBaseImagesInS3 = async ({
  commitHash,
  diffId,
  bucket,
  owner,
  repo
}: AcceptVisualChangesInput) => {
  const reasonToPreventUpdate =
    commitHash &&
    (await findReasonToPreventBaseImageUpdate(owner, repo, commitHash));
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

  const s3Paths = await getKeysFromS3(hash, bucket);
  await replaceImagesInS3(s3Paths, bucket);
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

export const replaceImagesInS3 = async (s3Paths: string[], bucket: string) => {
  const newImagePaths = filterNewImages(s3Paths);
  const baseImagePaths = getBaseImagePaths(newImagePaths);
  return await Promise.all(
    baseImagePaths.map((path, index) =>
      S3Client.copyObject({
        Bucket: bucket,
        CopySource: `${bucket}/${newImagePaths[index]}`,
        Key: path,
        ACL: 'bucket-owner-full-control'
      })
    )
  );
};
