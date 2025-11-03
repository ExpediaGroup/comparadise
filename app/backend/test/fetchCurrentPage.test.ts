import { fetchCurrentPage } from '../src/fetchCurrentPage';
import { describe, expect, it, mock } from 'bun:test';
import { NEW_IMAGES_DIRECTORY } from 'shared';

mock.module('../src/getTemporaryObjectUrl', () => ({
  getTemporaryObjectUrl: mock(() => 'url')
}));
const pathPrefix = `${NEW_IMAGES_DIRECTORY}/hash`;
const getKeysFromS3Mock = mock(() => [
  `${pathPrefix}/SMALL/srpPage/base.png`,
  `${pathPrefix}/SMALL/srpPage/diff.png`,
  `${pathPrefix}/SMALL/srpPage/new.png`,
  `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png`
]);
mock.module('../src/getKeysFromS3', () => ({
  getKeysFromS3: getKeysFromS3Mock
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
      nextPage: 2
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
      nextPage: undefined
    });
  });

  it('should throw when page is not found', async () => {
    expect(
      fetchCurrentPage({
        hash: 'hash',
        bucket: 'bucket',
        page: 12
      })
    ).rejects.toThrow('Page 12 does not exist. Only 2 pages were found.');
  });
});
