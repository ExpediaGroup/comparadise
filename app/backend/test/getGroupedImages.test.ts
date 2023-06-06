import { getGroupedImages } from '../src/getGroupedImages';
import { listAllS3PathsForHash } from '../src/listAllS3PathsForHash';
import { getBase64StringFromS3 } from '../src/getBase64StringFromS3';

jest.mock('../src/getBase64StringFromS3');
jest.mock('../src/listAllS3PathsForHash');

describe('getGroupedImages', () => {
  beforeEach(() => {
    (getBase64StringFromS3 as jest.Mock).mockResolvedValue('base64');
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns only the keys where there is a base, new, and diff', async () => {
    (listAllS3PathsForHash as jest.Mock).mockResolvedValue([
      'hash/EXTRA_LARGE/srpPage/base.png',
      'hash/SMALL/srpPage/base.png',
      'hash/EXTRA_LARGE/pdpPage/base.png',
      'hash/EXTRA_LARGE/pdpPage/diff.png',
      'hash/EXTRA_LARGE/pdpPage/new.png'
    ]);
    const paths = await getGroupedImages({ hash: 'hash', bucket: 'bucket' });
    expect(paths).toEqual([
      {
        name: 'EXTRA_LARGE/pdpPage',
        entries: [
          { image: 'base64', key: 'EXTRA_LARGE/pdpPage', name: 'base' },
          { image: 'base64', key: 'EXTRA_LARGE/pdpPage', name: 'diff' },
          { image: 'base64', key: 'EXTRA_LARGE/pdpPage', name: 'new' }
        ]
      }
    ]);
  });

  it('tells us if the commit hash was not associated with a visual regression test failure', async () => {
    (listAllS3PathsForHash as jest.Mock).mockResolvedValue(undefined);
    await expect(() => getGroupedImages({ hash: 'hash', bucket: 'bucket' })).rejects.toThrow(
      'The commit hash was not associated with any visual regression test failures'
    );
  });

  it('tells us if there are no new or diff images associated with the commit hash', async () => {
    (listAllS3PathsForHash as jest.Mock).mockResolvedValue([
      'hash/EXTRA_LARGE/srpPage/base.png',
      'hash/SMALL/srpPage/base.png',
      'hash/EXTRA_LARGE/pdpPage/base.png'
    ]);
    await expect(() => getGroupedImages({ hash: 'hash', bucket: 'bucket' })).rejects.toThrow(
      'There was no new or diff images associated with the commit hash.\nThis might be because the tests failed before a picture could be taken and it could be compared to the base.'
    );
  });

  it('returns keys where there is a new image but no base image', async () => {
    (listAllS3PathsForHash as jest.Mock).mockResolvedValue([
      'hash/EXTRA_LARGE/srpPage/base.png',
      'hash/SMALL/pdpPage/new.png',
      'hash/EXTRA_LARGE/pdpPage/base.png'
    ]);
    const paths = await getGroupedImages({ hash: 'hash', bucket: 'bucket' });

    expect(paths).toEqual([
      {
        name: 'SMALL/pdpPage',
        entries: [{ image: 'base64', key: 'SMALL/pdpPage', name: 'new' }]
      }
    ]);
  });
});
