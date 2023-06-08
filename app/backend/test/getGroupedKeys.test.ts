import { getGroupedKeys } from '../src/getGroupedKeys';
import { getKeysFromS3 } from '../src/getKeysFromS3';

jest.mock('../src/getKeysFromS3');

describe('getGroupedKeys', () => {
  it('returns only the keys where there is a base, new, and diff', async () => {
    (getKeysFromS3 as jest.Mock).mockResolvedValue([
      'hash/EXTRA_LARGE/srpPage/base.png',
      'hash/SMALL/srpPage/base.png',
      'hash/EXTRA_LARGE/pdpPage/base.png',
      'hash/EXTRA_LARGE/pdpPage/diff.png',
      'hash/EXTRA_LARGE/pdpPage/new.png',
      'ome/actions-runner/something'
    ]);
    const paths = await getGroupedKeys('hash', 'bucket');
    expect(paths).toEqual([
      {
        title: 'EXTRA_LARGE/pdpPage',
        keys: ['hash/EXTRA_LARGE/pdpPage/base.png', 'hash/EXTRA_LARGE/pdpPage/diff.png', 'hash/EXTRA_LARGE/pdpPage/new.png']
      }
    ]);
  });

  it('returns keys where there is a new image but no base image', async () => {
    (getKeysFromS3 as jest.Mock).mockResolvedValue([
      'hash/EXTRA_LARGE/srpPage/base.png',
      'hash/SMALL/pdpPage/new.png',
      'hash/EXTRA_LARGE/pdpPage/base.png'
    ]);
    const paths = await getGroupedKeys('hash', 'bucket');
    expect(paths).toEqual([
      {
        title: 'SMALL/pdpPage',
        keys: ['hash/SMALL/pdpPage/new.png']
      }
    ]);
  });

  it('returns multiple pages', async () => {
    (getKeysFromS3 as jest.Mock).mockResolvedValue([
      'hash/EXTRA_LARGE/srpPage/base.png',
      'hash/SMALL/srpPage/base.png',
      'hash/SMALL/srpPage/diff.png',
      'hash/SMALL/srpPage/new.png',
      'hash/EXTRA_LARGE/pdpPage/base.png',
      'hash/EXTRA_LARGE/pdpPage/diff.png',
      'hash/EXTRA_LARGE/pdpPage/new.png'
    ]);
    const paths = await getGroupedKeys('hash', 'bucket');
    expect(paths).toEqual([
      {
        title: 'SMALL/srpPage',
        keys: ['hash/SMALL/srpPage/base.png', 'hash/SMALL/srpPage/diff.png', 'hash/SMALL/srpPage/new.png']
      },
      {
        title: 'EXTRA_LARGE/pdpPage',
        keys: ['hash/EXTRA_LARGE/pdpPage/base.png', 'hash/EXTRA_LARGE/pdpPage/diff.png', 'hash/EXTRA_LARGE/pdpPage/new.png']
      }
    ]);
  });

  it('tells us if the commit hash was not associated with a visual regression test failure', async () => {
    (getKeysFromS3 as jest.Mock).mockResolvedValue([]);
    await expect(() => getGroupedKeys('hash', 'bucket')).rejects.toThrow(
      'The commit hash was not associated with any visual regression test failures'
    );
  });

  it('tells us if there are no new or diff images associated with the commit hash', async () => {
    (getKeysFromS3 as jest.Mock).mockResolvedValue([
      'hash/EXTRA_LARGE/srpPage/base.png',
      'hash/SMALL/srpPage/base.png',
      'hash/EXTRA_LARGE/pdpPage/base.png'
    ]);
    await expect(() => getGroupedKeys('hash', 'bucket')).rejects.toThrow(
      'There was no new or diff images associated with the commit hash.\nThis might be because the tests failed before a picture could be taken and it could be compared to the base.'
    );
  });
});
