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
  CopyObjectCommandOutput,
  DeleteObjectsCommand,
  DeleteObjectsCommandInput,
  DeleteObjectsCommandOutput
} from '@aws-sdk/client-s3';
import {
  BASE_IMAGES_DIRECTORY,
  BASE_IMAGE_NAME,
  NEW_IMAGE_NAME,
  NEW_IMAGES_DIRECTORY,
  ORIGINAL_NEW_IMAGES_DIRECTORY
} from './constants';

export type S3Operations = ReturnType<typeof createS3Operations>;

export function createS3Operations(client: S3Client = new S3Client()) {
  function listObjects(
    input: ListObjectsV2CommandInput
  ): Promise<ListObjectsV2CommandOutput> {
    return client.send(new ListObjectsV2Command(input));
  }

  async function listAllObjects(
    input: Omit<ListObjectsV2CommandInput, 'ContinuationToken'>,
    continuationToken?: string
  ): Promise<NonNullable<ListObjectsV2CommandOutput['Contents']>> {
    const response = await listObjects({
      ...input,
      ...(continuationToken && { ContinuationToken: continuationToken })
    });
    const contents = response.Contents ?? [];
    if (!response.IsTruncated) return contents;
    const remaining = await listAllObjects(
      input,
      response.NextContinuationToken
    );
    return [...contents, ...remaining];
  }

  function getObject(
    input: GetObjectCommandInput
  ): Promise<GetObjectCommandOutput> {
    return client.send(new GetObjectCommand(input));
  }

  function putObject(
    input: PutObjectCommandInput
  ): Promise<PutObjectCommandOutput> {
    return client.send(new PutObjectCommand(input));
  }

  function copyObject(
    input: CopyObjectCommandInput
  ): Promise<CopyObjectCommandOutput> {
    return client.send(new CopyObjectCommand(input));
  }

  function deleteObjects(
    input: DeleteObjectsCommandInput
  ): Promise<DeleteObjectsCommandOutput> {
    return client.send(new DeleteObjectsCommand(input));
  }

  function encodeS3CopySource(bucket: string, key: string): string {
    return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  function filterNewImages(s3Paths: string[]): string[] {
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

  async function getKeysFromS3(
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

  function getBaseImagePaths(newImagePaths: string[]) {
    return toBaseImagePaths(newImagePaths, NEW_IMAGES_DIRECTORY);
  }

  function getBaseImagePathsFromOriginal(originalNewImagePaths: string[]) {
    return toBaseImagePaths(
      originalNewImagePaths,
      ORIGINAL_NEW_IMAGES_DIRECTORY
    );
  }

  async function copyImages(
    sourcePaths: string[],
    destPaths: string[],
    bucket: string,
    log?: (message: string) => void
  ): Promise<void> {
    await Promise.all(
      destPaths.map(async (path, index) => {
        const copySource = sourcePaths[index];
        if (!copySource) {
          throw new Error(`Source path not found for index ${index}`);
        }
        log?.(`Copying ${copySource} to ${path}`);
        await copyObject({
          Bucket: bucket,
          CopySource: encodeS3CopySource(bucket, copySource),
          Key: path,
          ACL: 'bucket-owner-full-control'
        });
      })
    );
  }

  async function copyNewImagesToBase(
    s3Paths: string[],
    bucket: string,
    log?: (message: string) => void
  ) {
    const newImagePaths = filterNewImages(s3Paths);
    const baseImagePaths = getBaseImagePaths(newImagePaths);
    return copyImages(newImagePaths, baseImagePaths, bucket, log);
  }

  async function copyOriginalImagesToBase(
    originalPaths: string[],
    bucket: string,
    log?: (message: string) => void
  ) {
    const newImagePaths = filterNewImages(originalPaths);
    const baseImagePaths = getBaseImagePathsFromOriginal(newImagePaths);
    return copyImages(newImagePaths, baseImagePaths, bucket, log);
  }

  async function updateBaseImages(
    hash: string,
    bucket: string,
    log?: (message: string) => void
  ) {
    const originalNewImagePaths = await getKeysFromS3(
      ORIGINAL_NEW_IMAGES_DIRECTORY,
      hash,
      bucket
    );
    if (originalNewImagePaths.length > 0) {
      await copyOriginalImagesToBase(originalNewImagePaths, bucket, log);
    } else {
      const s3Paths = await getKeysFromS3(NEW_IMAGES_DIRECTORY, hash, bucket);
      await copyNewImagesToBase(s3Paths, bucket, log);
    }
  }

  return {
    client,
    listObjects,
    listAllObjects,
    getObject,
    putObject,
    copyObject,
    deleteObjects,
    filterNewImages,
    getKeysFromS3,
    getBaseImagePaths,
    getBaseImagePathsFromOriginal,
    updateBaseImages
  };
}

const defaultS3Operations = createS3Operations();

export const s3Client = defaultS3Operations.client;
export const listObjects = defaultS3Operations.listObjects;
export const listAllObjects = defaultS3Operations.listAllObjects;
export const getObject = defaultS3Operations.getObject;
export const putObject = defaultS3Operations.putObject;
export const copyObject = defaultS3Operations.copyObject;
export const deleteObjects = defaultS3Operations.deleteObjects;
export const filterNewImages = defaultS3Operations.filterNewImages;
export const getKeysFromS3 = defaultS3Operations.getKeysFromS3;
export const getBaseImagePaths = defaultS3Operations.getBaseImagePaths;
export const getBaseImagePathsFromOriginal =
  defaultS3Operations.getBaseImagePathsFromOriginal;
export const updateBaseImages = defaultS3Operations.updateBaseImages;
