import { S3Client } from './s3Client';

export const getKeysFromS3 = async (hash: string, bucket: string) => {
  const response = await S3Client.listObjectsV2({
    Bucket: bucket,
    Prefix: hash
  });

  return (
    response?.Contents?.map(content => content.Key ?? '').filter(
      path => path && !path.includes('actions-runner')
    ) ?? []
  );
};
