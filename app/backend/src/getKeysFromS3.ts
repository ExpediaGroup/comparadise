import { listAllObjects } from 'shared';

// Info on working with nested object path prefixes: https://realguess.net/2014/05/24/amazon-s3-delimiter-and-prefix/#Prefix
export async function getKeysFromS3(
  directory: string,
  hash: string,
  bucket: string
) {
  const allContents = await listAllObjects({
    Bucket: bucket,
    Prefix: `${directory}/${hash}/`
  });

  const keys = allContents.map(content => content.Key ?? '');
  return keys.filter(path => path && !path.includes('actions-runner'));
}
