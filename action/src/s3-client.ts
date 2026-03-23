import {
  S3Client,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
  ListObjectsV2CommandOutput,
  GetObjectCommand,
  GetObjectCommandInput,
  GetObjectCommandOutput,
  PutObjectCommand,
  PutObjectCommandInput,
  PutObjectCommandOutput
} from '@aws-sdk/client-s3';

const s3Client = new S3Client();

export const listObjects = (
  input: ListObjectsV2CommandInput
): Promise<ListObjectsV2CommandOutput> =>
  s3Client.send(new ListObjectsV2Command(input));

export const listAllObjects = async (
  input: Omit<ListObjectsV2CommandInput, 'ContinuationToken'>,
  continuationToken?: string
): Promise<NonNullable<ListObjectsV2CommandOutput['Contents']>> => {
  const response = await listObjects({
    ...input,
    ...(continuationToken && { ContinuationToken: continuationToken })
  });
  const contents = response.Contents ?? [];
  if (!response.IsTruncated) return contents;
  const remaining = await listAllObjects(input, response.NextContinuationToken);
  return [...contents, ...remaining];
};

export const getObject = (
  input: GetObjectCommandInput
): Promise<GetObjectCommandOutput> =>
  s3Client.send(new GetObjectCommand(input));

export const putObject = (
  input: PutObjectCommandInput
): Promise<PutObjectCommandOutput> =>
  s3Client.send(new PutObjectCommand(input));
