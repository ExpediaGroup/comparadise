import { fetchCurrentPage } from '../src/fetchCurrentPage';
import { describe, expect, it, mock } from 'bun:test';
import { NEW_IMAGES_DIRECTORY } from 'shared';

mock.module('../src/getTemporaryObjectUrl', () => ({
  getTemporaryObjectUrl: mock(() => 'url')
}));
const pathPrefix = `${NEW_IMAGES_DIRECTORY}/hash`;
const listObjectsV2Mock = mock(() => ({
  Contents: [
    { Key: `${pathPrefix}/SMALL/srpPage/base.png` },
    { Key: `${pathPrefix}/SMALL/srpPage/diff.png` },
    { Key: `${pathPrefix}/SMALL/srpPage/new.png` },
    { Key: `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png }` },
    { Key: `${pathPrefix}/LARGE/invalidPage/invalid.png` },
    { Key: `${pathPrefix}/LARGE/invalidPage/new.png` }
  ]
}));
mock.module('../src/s3Client', () => ({
  S3Client: {
    listObjectsV2: listObjectsV2Mock
  }
}));

describe('fetchCurrentPage', () => {
  it('should get first page of images', async () => {
    const result = await fetchCurrentPage({
      hash: 'hash',
      bucket: 'bucket',
      page: 1
    });
    expect(result).toEqual({
      title: 'SMALL/srpPage',
      images: [
        {
          name: 'base',
          url: 'url'
        },
        {
          name: 'diff',
          url: 'url'
        },
        {
          name: 'new',
          url: 'url'
        }
      ],
      nextPage: 2,
      totalPages: 3
    });
  });

  it('should get subsequent page of images', async () => {
    const result = await fetchCurrentPage({
      hash: 'hash',
      bucket: 'bucket',
      page: 2
    });
    expect(result).toEqual({
      title: 'EXTRA_LARGE/pdpPage',
      images: [
        {
          name: 'new',
          url: 'url'
        }
      ],
      nextPage: 3,
      totalPages: 3
    });
  });

  it('should throw when page is not found', async () => {
    expect(
      fetchCurrentPage({
        hash: 'hash',
        bucket: 'bucket',
        page: 12
      })
    ).rejects.toThrow('Page 12 does not exist. Only 3 pages were found.');
  });

  it('should throw when a key does not conform to fileNameSchema', async () => {
    expect(
      fetchCurrentPage({
        hash: 'hash',
        bucket: 'bucket',
        page: 3
      })
    ).rejects.toThrow('Invalid file name');
  });
});
