import { s3Client } from './s3Client';

export const copyS3File = async (
  sourceKey: string,
  destinationKey: string,
  bucket: string
): Promise<void> => {
  const sourceFile = s3Client.file(sourceKey, { bucket });
  if (!(await sourceFile.exists())) {
    throw new Error(`Source object not found: ${bucket}/${sourceKey}`);
  }

  const body = await sourceFile.arrayBuffer();
  await s3Client
    .file(destinationKey, { bucket })
    .write(body, { acl: 'bucket-owner-full-control' });
};
