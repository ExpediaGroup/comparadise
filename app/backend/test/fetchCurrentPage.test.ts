import { fetchCurrentPage } from '../src/fetchCurrentPage';
import { describe, expect, it, mock, spyOn } from 'bun:test';
import { NEW_IMAGES_DIRECTORY } from 'shared/constants';
import * as presigner from '@aws-sdk/s3-request-presigner';
import type { S3Client } from '@aws-sdk/client-s3';
import type { S3Operations } from 'shared/s3';

spyOn(presigner, 'getSignedUrl').mockResolvedValue('url');

const pathPrefix = `${NEW_IMAGES_DIRECTORY}/hash`;
const getKeysFromS3Mock = mock(() =>
  Promise.resolve([
    `${pathPrefix}/SMALL/srpPage/base.png`,
    `${pathPrefix}/SMALL/srpPage/diff.png`,
    `${pathPrefix}/SMALL/srpPage/new.png`,
    `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png }`,
    `${pathPrefix}/LARGE/invalidPage/invalid.png`,
    `${pathPrefix}/LARGE/invalidPage/new.png`
  ])
);

const fakeClient = {} as S3Client;

const makeS3 = (): Pick<S3Operations, 'getKeysFromS3' | 'client'> => ({
  getKeysFromS3: getKeysFromS3Mock,
  client: fakeClient
});

describe('fetchCurrentPage', () => {
  it('should get first page of images', async () => {
    const result = await fetchCurrentPage(
      { hash: 'hash', bucket: 'bucket', page: 1 },
      makeS3()
    );
    expect(result).toEqual({
      title: 'SMALL/srpPage',
      images: [
        { name: 'base', url: 'url' },
        { name: 'diff', url: 'url' },
        { name: 'new', url: 'url' }
      ],
      nextPage: 2,
      totalPages: 3
    });
  });

  it('should get subsequent page of images', async () => {
    const result = await fetchCurrentPage(
      { hash: 'hash', bucket: 'bucket', page: 2 },
      makeS3()
    );
    expect(result).toEqual({
      title: 'EXTRA_LARGE/pdpPage',
      images: [{ name: 'new', url: 'url' }],
      nextPage: 3,
      totalPages: 3
    });
  });

  it('should throw when page is not found', async () => {
    expect(
      fetchCurrentPage({ hash: 'hash', bucket: 'bucket', page: 12 }, makeS3())
    ).rejects.toThrow('Page 12 does not exist. Only 3 pages were found.');
  });

  it('should throw when a key does not conform to fileNameSchema', async () => {
    expect(
      fetchCurrentPage({ hash: 'hash', bucket: 'bucket', page: 3 }, makeS3())
    ).rejects.toThrow('Invalid file name');
  });
});
