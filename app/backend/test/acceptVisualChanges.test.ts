import { acceptVisualChanges } from '../src/acceptVisualChanges';
import {
  BASE_IMAGES_DIRECTORY,
  BASE_IMAGE_NAME,
  NEW_IMAGES_DIRECTORY,
  NEW_IMAGE_NAME,
  ORIGINAL_NEW_IMAGES_DIRECTORY
} from 'shared/constants';
import {
  filterNewImages,
  getBaseImagePaths,
  getBaseImagePathsFromOriginal
} from 'shared/s3';
import { afterEach, describe, expect, it, mock } from 'bun:test';

const copyObjectMock = mock();
const listObjectsMock = mock();
mock.module('shared/s3', () => ({
  s3Client: {},
  listObjects: listObjectsMock,
  listAllObjects,
  getKeysFromS3,
  filterNewImages,
  toBaseImagePath,
  getBaseImagePaths,
  getBaseImagePathsFromOriginal,
  encodeS3CopySource,
  updateBaseImages,
  getObject: mock(),
  putObject: mock(),
  copyObject: copyObjectMock
}));

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
  return toBaseImagePaths(originalNewImagePaths, ORIGINAL_NEW_IMAGES_DIRECTORY);
}

async function getKeysFromS3(directory: string, hash: string, bucket: string) {
  const allContents = await listAllObjects({
    Bucket: bucket,
    Prefix: `${directory}/${hash}/`
  });
  const keys = allContents.map(
    (content: { Key?: string }) => content.Key ?? ''
  );
  return keys.filter(
    (path: string) => path && !path.includes('actions-runner')
  );
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
      await copyObjectMock({
        Bucket: bucket,
        CopySource: encodeS3CopySource(bucket, copySource),
        Key: path,
        ACL: 'bucket-owner-full-control'
      });
    })
  );
}

async function updateBaseImages(hash: string, bucket: string) {
  const originalNewImagePaths = await getKeysFromS3(
    ORIGINAL_NEW_IMAGES_DIRECTORY,
    hash,
    bucket
  );
  if (originalNewImagePaths.length > 0) {
    const newImagePaths = filterNewImages(originalNewImagePaths);
    const baseImagePaths = getBaseImagePathsFromOriginal(newImagePaths);
    await copyImages(newImagePaths, baseImagePaths, bucket);
  } else {
    const s3Paths = await getKeysFromS3(NEW_IMAGES_DIRECTORY, hash, bucket);
    const newImagePaths = filterNewImages(s3Paths);
    const baseImagePaths = getBaseImagePaths(newImagePaths);
    await copyImages(newImagePaths, baseImagePaths, bucket);
  }
}

async function listAllObjects(
  input: { Bucket: string; Prefix: string; ContinuationToken?: string },
  continuationToken?: string
) {
  const response = await listObjectsMock({
    ...input,
    ...(continuationToken && { ContinuationToken: continuationToken })
  });
  const contents = response.Contents ?? [];
  if (!response.IsTruncated) return contents;
  return [
    ...contents,
    ...(await listAllObjects(input, response.NextContinuationToken))
  ];
}

const listCommitStatusesForRefMock = mock(() => ({
  data: [
    {
      context: 'unit tests',
      state: 'success',
      created_at: '2023-05-02T19:11:02Z'
    }
  ]
}));
mock.module('../src/getOctokit', () => ({
  getOctokit: mock(() => ({
    rest: {
      repos: {
        listCommitStatusesForRef: listCommitStatusesForRefMock
      }
    }
  }))
}));
const updateCommitStatusMock = mock();
mock.module('../src/updateCommitStatus', () => ({
  updateCommitStatus: updateCommitStatusMock
}));
mock.module('@octokit/rest', () => ({
  Octokit: mock()
}));

const pathPrefix = `${NEW_IMAGES_DIRECTORY}/030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5`;
const originalPathPrefix = `${ORIGINAL_NEW_IMAGES_DIRECTORY}/030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5`;
describe('acceptVisualChanges', () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  describe('filterNewImages', () => {
    it('should filter only the new images from the given paths', () => {
      const newImage = `${pathPrefix}/SMALL/pdpPage/new.png`;
      const diffImage = `${pathPrefix}/SMALL/pdpPage/diff.png`;
      const images = filterNewImages([newImage, diffImage]);
      expect(images).toHaveLength(1);
      expect(images[0]).toBe(newImage);
    });

    it('should filter only the new images when many paths given', () => {
      const images = filterNewImages([
        `${pathPrefix}/SMALL/pdpPage/new.png`,
        `${pathPrefix}/SMALL/pdpPage/diff.png`,
        `${pathPrefix}/LARGE/srpPage/new.png`,
        `${pathPrefix}/LARGE/pdpPage/base.png`
      ]);
      expect(images).toEqual([
        `${pathPrefix}/SMALL/pdpPage/new.png`,
        `${pathPrefix}/LARGE/srpPage/new.png`
      ]);
    });
  });

  describe('getBaseImagesPaths', () => {
    it('should return the base image paths given the new image paths', () => {
      const paths = [
        `${pathPrefix}/SMALL/pdpPage/new.png`,
        `${pathPrefix}/LARGE/srpPage/new.png`
      ];
      const result = getBaseImagePaths(paths);
      expect(result).toEqual([
        `${BASE_IMAGES_DIRECTORY}/SMALL/pdpPage/base.png`,
        `${BASE_IMAGES_DIRECTORY}/LARGE/srpPage/base.png`
      ]);
    });
  });

  describe('acceptVisualChanges', () => {
    it('should throw error if other required checks have not yet passed', async () => {
      listCommitStatusesForRefMock.mockImplementationOnce(() => ({
        data: [
          {
            context: 'unit tests',
            state: 'success',
            created_at: '2023-05-02T19:11:02Z'
          },
          {
            context: 'other tests',
            state: 'failure',
            created_at: '2023-05-02T19:11:02Z'
          }
        ]
      }));

      const expectedBucket = 'expected-bucket-name';
      expect(
        acceptVisualChanges(
          {
            commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
            bucket: expectedBucket,
            useBaseImages: true,
            repo: 'repo',
            owner: 'owner'
          },
          { urlParams: {} }
        )
      ).rejects.toThrow();

      expect(listObjectsMock).not.toHaveBeenCalled();
      expect(copyObjectMock).not.toHaveBeenCalled();
      expect(updateCommitStatusMock).not.toHaveBeenCalled();
    });

    it('should update commit status but not base images if useBaseImages is false', async () => {
      const expectedBucket = 'expected-bucket-name';
      await acceptVisualChanges(
        {
          commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
          bucket: expectedBucket,
          useBaseImages: false,
          repo: 'repo',
          owner: 'owner'
        },
        { urlParams: {} }
      );

      expect(listObjectsMock).not.toHaveBeenCalled();
      expect(copyObjectMock).not.toHaveBeenCalled();
      expect(updateCommitStatusMock).toHaveBeenCalled();
    });

    it('should copy from original-new-images when originals are present', async () => {
      const expectedBucket = 'expected-bucket-name';
      listObjectsMock.mockImplementationOnce(() => ({
        Contents: [{ Key: `${originalPathPrefix}/SMALL/pdpPage/new.png` }]
      }));

      await acceptVisualChanges(
        {
          commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
          bucket: expectedBucket,
          useBaseImages: true,
          repo: 'repo',
          owner: 'owner'
        },
        { urlParams: {} }
      );

      expect(copyObjectMock).toHaveBeenCalledTimes(1);
      expect(copyObjectMock).toHaveBeenCalledWith({
        Bucket: expectedBucket,
        CopySource: `${expectedBucket}/${originalPathPrefix}/SMALL/pdpPage/new.png`,
        Key: `${BASE_IMAGES_DIRECTORY}/SMALL/pdpPage/base.png`,
        ACL: 'bucket-owner-full-control'
      });
    });

    it('should fall back to new-images when no originals are present', async () => {
      const expectedBucket = 'expected-bucket-name';
      listObjectsMock
        .mockImplementationOnce(() => ({ Contents: [] }))
        .mockImplementationOnce(() => ({
          Contents: [
            { Key: `${pathPrefix}/SMALL/pdpPage/new.png` },
            { Key: `${pathPrefix}/SMALL/pdpPage/diff.png` }
          ]
        }));

      await acceptVisualChanges(
        {
          commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
          bucket: expectedBucket,
          useBaseImages: true,
          repo: 'repo',
          owner: 'owner'
        },
        { urlParams: {} }
      );

      expect(copyObjectMock).toHaveBeenCalledTimes(1);
      expect(copyObjectMock).toHaveBeenCalledWith({
        Bucket: expectedBucket,
        CopySource: `${expectedBucket}/${pathPrefix}/SMALL/pdpPage/new.png`,
        Key: `${BASE_IMAGES_DIRECTORY}/SMALL/pdpPage/base.png`,
        ACL: 'bucket-owner-full-control'
      });
    });
  });

  describe('getBaseImagePathsFromOriginal', () => {
    it('should convert original-new-images paths to base-images paths', () => {
      const paths = [
        `${originalPathPrefix}/SMALL/pdpPage/new.png`,
        `${originalPathPrefix}/LARGE/srpPage/new.png`
      ];
      const result = getBaseImagePathsFromOriginal(paths);
      expect(result).toEqual([
        `${BASE_IMAGES_DIRECTORY}/SMALL/pdpPage/base.png`,
        `${BASE_IMAGES_DIRECTORY}/LARGE/srpPage/base.png`
      ]);
    });
  });
});
