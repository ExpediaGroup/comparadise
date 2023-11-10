import { fetchCurrentPage } from '../src/fetchCurrentPage';
import { getTemporaryObjectUrl } from '../src/getTemporaryObjectUrl';
import { getGroupedKeys } from '../src/getGroupedKeys';

jest.mock('../src/getGroupedKeys');
jest.mock('../src/getTemporaryObjectUrl');

(getGroupedKeys as jest.Mock).mockResolvedValue([
  {
    title: 'SMALL/srpPage',
    keys: [
      'hash/SMALL/srpPage/base.png',
      'hash/SMALL/srpPage/diff.png',
      'hash/SMALL/srpPage/new.png'
    ]
  },
  {
    title: 'EXTRA_LARGE/pdpPage',
    keys: ['hash/EXTRA_LARGE/pdpPage/new.png']
  }
]);
(getTemporaryObjectUrl as jest.Mock).mockResolvedValue('url');

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
    await expect(() =>
      fetchCurrentPage({
        hash: 'hash',
        bucket: 'bucket',
        page: 12
      })
    ).rejects.toThrow('Page 12 does not exist. Only 2 pages were found.');
  });
});
