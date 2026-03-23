import { S3, ListObjectsV2CommandInput } from '@aws-sdk/client-s3';

export const S3Client = new S3();

export async function listAllObjects(
  input: Omit<ListObjectsV2CommandInput, 'ContinuationToken'>,
  continuationToken?: string
): Promise<{ Key?: string }[]> {
  const response = await S3Client.listObjectsV2({
    ...input,
    ...(continuationToken && { ContinuationToken: continuationToken })
  });
  const contents = response.Contents ?? [];
  if (!response.IsTruncated) return contents;
  const remaining = await listAllObjects(input, response.NextContinuationToken);
  return [...contents, ...remaining];
}
