import { fetchCurrentPage } from '../src/fetchCurrentPage';
import { getBase64StringFromS3 } from '../src/getBase64StringFromS3';
import { getGroupedKeys } from '../src/getGroupedKeys';

jest.mock('../src/getGroupedKeys');
jest.mock('../src/getBase64StringFromS3');

(getGroupedKeys as jest.Mock).mockResolvedValue([
  {
    title: 'SMALL/srpPage',
    keys: ['hash/SMALL/srpPage/base.png', 'hash/SMALL/srpPage/diff.png', 'hash/SMALL/srpPage/new.png']
  },
  {
    title: 'EXTRA_LARGE/pdpPage',
    keys: ['hash/EXTRA_LARGE/pdpPage/new.png']
  }
]);
(getBase64StringFromS3 as jest.Mock).mockResolvedValue('base64');

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
          base64: 'base64'
        },
        {
          name: 'diff',
          base64: 'base64'
        },
        {
          name: 'new',
          base64: 'base64'
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
          base64: 'base64'
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
