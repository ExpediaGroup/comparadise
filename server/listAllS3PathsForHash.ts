import { S3Client } from './s3Client';

export const listAllS3PathsForHash = async (hash: string, bucket: string) => {
  const response = await S3Client.listObjectsV2({
    Bucket: bucket,
    Prefix: hash
  });

  return response?.Contents?.map(content => content.Key).filter(path => !path?.includes('actions-runner'));
};
