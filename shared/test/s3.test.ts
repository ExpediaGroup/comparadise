import { afterEach, describe, expect, it, mock } from 'bun:test';
import {
  BASE_IMAGES_DIRECTORY,
  NEW_IMAGES_DIRECTORY,
  ORIGINAL_NEW_IMAGES_DIRECTORY
} from 'shared/constants';

const listObjectsMock = mock(() => ({
  Contents: [
    {
      Key: 'ome/actions-runner/something'
    },
    {
      Key: 'a/normal/key'
    }
  ]
}));
mock.module('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = listObjectsMock;
  },
  ListObjectsV2Command: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {},
  PutObjectCommand: class {},
  CopyObjectCommand: class {}
}));

const {
  filterNewImages,
  getBaseImagePaths,
  getBaseImagePathsFromOriginal,
  getKeysFromS3
} = await import('shared/s3');

const pathPrefix = `${NEW_IMAGES_DIRECTORY}/030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5`;
const originalPathPrefix = `${ORIGINAL_NEW_IMAGES_DIRECTORY}/030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5`;

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

describe('getBaseImagePaths', () => {
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

describe('getKeysFromS3', () => {
  afterEach(() => {
    listObjectsMock.mockClear();
  });

  it('returns keys filtering out actions-runner paths', async () => {
    const paths = await getKeysFromS3('new-images', 'hash', 'bucket');
    expect(paths).toEqual(['a/normal/key']);
  });

  it('paginates when results are truncated', async () => {
    listObjectsMock
      .mockImplementationOnce(() => ({
        Contents: [{ Key: 'new-images/hash/page1/new.png' }],
        IsTruncated: true,
        NextContinuationToken: 'token-1'
      }))
      .mockImplementationOnce(() => ({
        Contents: [{ Key: 'new-images/hash/page2/new.png' }],
        IsTruncated: false
      }));

    const paths = await getKeysFromS3('new-images', 'hash', 'bucket');

    expect(listObjectsMock).toHaveBeenCalledTimes(2);
    expect(paths).toEqual([
      'new-images/hash/page1/new.png',
      'new-images/hash/page2/new.png'
    ]);
  });
});
