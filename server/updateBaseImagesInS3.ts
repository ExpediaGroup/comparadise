import { S3Client } from './s3Client';
import { listAllS3PathsForHash } from './listAllS3PathsForHash';
import { BASE_IMAGE_NAME, NEW_IMAGE_NAME } from './constants';

export const updateBaseImagesInS3 = async (hash: string, bucket: string, baseImagesDirectory: string) => {
  const s3Paths = await listAllS3PathsForHash(hash, bucket);
  return await replaceImagesInS3(s3Paths, bucket, baseImagesDirectory);
};

export const filterNewImages = (s3Paths: string[]) => {
  return s3Paths.filter(path => path.match(new RegExp(`/${NEW_IMAGE_NAME}.png`)));
};

export const getBaseImagePaths = (newImagePaths: string[], baseImagesDirectory: string) => {
  return newImagePaths.map(path => {
    const commitHash = path.split('/')[0];
    return path.replace(commitHash, baseImagesDirectory).replace(NEW_IMAGE_NAME, BASE_IMAGE_NAME);
  });
};

export const replaceImagesInS3 = async (s3Paths: string[], bucket: string, baseImagesDirectory: string) => {
  const newImagePaths = filterNewImages(s3Paths);
  const baseImagePaths = getBaseImagePaths(newImagePaths, baseImagesDirectory);
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
