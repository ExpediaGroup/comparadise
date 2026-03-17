import { S3Client } from './s3Client';

// Info on working with nested object path prefixes: https://realguess.net/2014/05/24/amazon-s3-delimiter-and-prefix/#Prefix
export async function getKeysFromS3(
  directory: string,
  hash: string,
  bucket: string
) {
  const response = await S3Client.listObjectsV2({
    Bucket: bucket,
    Prefix: `${directory}/${hash}/`
  });

  const keys = response?.Contents?.map(content => content.Key ?? '') ?? [];
  return keys.filter(path => path && !path.includes('actions-runner'));
}
