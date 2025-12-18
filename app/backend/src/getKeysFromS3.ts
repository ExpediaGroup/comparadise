import { NEW_IMAGES_DIRECTORY } from 'shared';
import { s3Client } from './s3Client';

// Info on working with nested object path prefixes: https://realguess.net/2014/05/24/amazon-s3-delimiter-and-prefix/#Prefix
export const getKeysFromS3 = async (hash: string, bucket: string) => {
  const { contents } = await s3Client.list(
    {
      prefix: `${NEW_IMAGES_DIRECTORY}/${hash}/`
    },
    { bucket }
  );

  const keys = contents?.map(item => item.key) ?? [];
  return keys.filter(path => path && !path.includes('actions-runner'));
};
