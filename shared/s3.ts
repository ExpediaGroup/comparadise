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
  PutObjectCommandOutput,
  CopyObjectCommand,
  CopyObjectCommandInput,
  CopyObjectCommandOutput
} from '@aws-sdk/client-s3';
import {
  BASE_IMAGES_DIRECTORY,
  BASE_IMAGE_NAME,
  NEW_IMAGE_NAME,
  NEW_IMAGES_DIRECTORY,
  ORIGINAL_NEW_IMAGES_DIRECTORY
} from './constants';

export const s3Client = new S3Client();

export function listObjects(
  input: ListObjectsV2CommandInput
): Promise<ListObjectsV2CommandOutput> {
  return s3Client.send(new ListObjectsV2Command(input));
}

export async function listAllObjects(
  input: Omit<ListObjectsV2CommandInput, 'ContinuationToken'>,
  continuationToken?: string
): Promise<NonNullable<ListObjectsV2CommandOutput['Contents']>> {
  const response = await listObjects({
    ...input,
    ...(continuationToken && { ContinuationToken: continuationToken })
  });
  const contents = response.Contents ?? [];
  if (!response.IsTruncated) return contents;
  const remaining = await listAllObjects(input, response.NextContinuationToken);
  return [...contents, ...remaining];
}

export function getObject(
  input: GetObjectCommandInput
): Promise<GetObjectCommandOutput> {
  return s3Client.send(new GetObjectCommand(input));
}

export function putObject(
  input: PutObjectCommandInput
): Promise<PutObjectCommandOutput> {
  return s3Client.send(new PutObjectCommand(input));
}

export function copyObject(
  input: CopyObjectCommandInput
): Promise<CopyObjectCommandOutput> {
  return s3Client.send(new CopyObjectCommand(input));
}

function encodeS3CopySource(bucket: string, key: string): string {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function filterNewImages(s3Paths: string[]): string[] {
  return s3Paths.filter(path =>
    path.match(new RegExp(`/${NEW_IMAGE_NAME}.png`))
  );
}

function toBaseImagePath(
  path: string,
  sourceDirectory: string,
  hash: string
): string {
  return path
    .replace(`${sourceDirectory}/${hash}`, BASE_IMAGES_DIRECTORY)
    .replace(`${NEW_IMAGE_NAME}.png`, `${BASE_IMAGE_NAME}.png`);
}

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

function toBaseImagePaths(paths: string[], sourceDirectory: string) {
  return paths.map(path => {
    const commitHash = path.split('/')[1] ?? '';
    return toBaseImagePath(path, sourceDirectory, commitHash);
  });
}

export function getBaseImagePaths(newImagePaths: string[]) {
  return toBaseImagePaths(newImagePaths, NEW_IMAGES_DIRECTORY);
}

export function getBaseImagePathsFromOriginal(originalNewImagePaths: string[]) {
  return toBaseImagePaths(originalNewImagePaths, ORIGINAL_NEW_IMAGES_DIRECTORY);
}

async function copyImages(
  sourcePaths: string[],
  destPaths: string[],
  bucket: string
): Promise<void> {
  await Promise.all(
    destPaths.map(async (path, index) => {
      const copySource = sourcePaths[index];
      if (!copySource) {
        throw new Error(`Source path not found for index ${index}`);
      }
      await copyObject({
        Bucket: bucket,
        CopySource: encodeS3CopySource(bucket, copySource),
        Key: path,
        ACL: 'bucket-owner-full-control'
      });
    })
  );
}

async function copyNewImagesToBase(s3Paths: string[], bucket: string) {
  const newImagePaths = filterNewImages(s3Paths);
  const baseImagePaths = getBaseImagePaths(newImagePaths);
  return copyImages(newImagePaths, baseImagePaths, bucket);
}

async function copyOriginalImagesToBase(
  originalPaths: string[],
  bucket: string
) {
  const newImagePaths = filterNewImages(originalPaths);
  const baseImagePaths = getBaseImagePathsFromOriginal(newImagePaths);
  return copyImages(newImagePaths, baseImagePaths, bucket);
}

export async function updateBaseImages(hash: string, bucket: string) {
  const originalNewImagePaths = await getKeysFromS3(
    ORIGINAL_NEW_IMAGES_DIRECTORY,
    hash,
    bucket
  );
  if (originalNewImagePaths.length > 0) {
    await copyOriginalImagesToBase(originalNewImagePaths, bucket);
  } else {
    const s3Paths = await getKeysFromS3(NEW_IMAGES_DIRECTORY, hash, bucket);
    await copyNewImagesToBase(s3Paths, bucket);
  }
}
