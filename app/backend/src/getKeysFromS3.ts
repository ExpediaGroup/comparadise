import { NEW_IMAGES_DIRECTORY } from 'shared';
import { S3Client } from './s3Client';

// Info on working with nested object path prefixes: https://realguess.net/2014/05/24/amazon-s3-delimiter-and-prefix/#Prefix
export const getKeysFromS3 = async (hash: string, bucket: string) => {
  const response = await S3Client.listObjectsV2({
    Bucket: bucket,
    Prefix: `${NEW_IMAGES_DIRECTORY}/${hash}/`,
    Delimiter: '/'
  });

  return (
    response?.Contents?.map(content => content.Key ?? '').filter(
      path => path && !path.includes('actions-runner')
    ) ?? []
  );
};
