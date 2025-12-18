import { fetchCurrentPage } from '../src/fetchCurrentPage';
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { NEW_IMAGES_DIRECTORY } from 'shared';

mock.module('../src/getTemporaryObjectUrl', () => ({
  getTemporaryObjectUrl: mock(() => Promise.resolve('url'))
}));

const pathPrefix = `${NEW_IMAGES_DIRECTORY}/hash`;
const listMock = mock(async () => ({
  contents: [
    { key: `${pathPrefix}/SMALL/srpPage/base.png` },
    { key: `${pathPrefix}/SMALL/srpPage/diff.png` },
    { key: `${pathPrefix}/SMALL/srpPage/new.png` },
    { key: `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png` }
  ]
}));

mock.module('../src/s3Client', () => ({
  s3Client: {
    list: listMock
  }
}));

beforeEach(() => {
  mock.clearAllMocks();
  listMock.mockImplementation(async () => ({
    contents: [
      { key: `${pathPrefix}/SMALL/srpPage/base.png` },
      { key: `${pathPrefix}/SMALL/srpPage/diff.png` },
      { key: `${pathPrefix}/SMALL/srpPage/new.png` },
      { key: `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png` }
    ]
  }));
});

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
