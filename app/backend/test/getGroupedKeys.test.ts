import { NEW_IMAGES_DIRECTORY } from 'shared';
import { getGroupedKeys } from '../src/getGroupedKeys';
import { getKeysFromS3 } from '../src/getKeysFromS3';
import { expect } from '@jest/globals';

jest.mock('../src/getKeysFromS3');

const pathPrefix = `${NEW_IMAGES_DIRECTORY}/hash`;

describe('getGroupedKeys', () => {
  it('returns only the keys where there is a base, new, and diff', async () => {
    (getKeysFromS3 as jest.Mock).mockResolvedValue([
      `${pathPrefix}/EXTRA_LARGE/srpPage/base.png`,
      `${pathPrefix}/SMALL/srpPage/base.png`,
      `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png`,
      `${pathPrefix}/EXTRA_LARGE/pdpPage/diff.png`,
      `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png`,
      'ome/actions-runner/something'
    ]);
    const paths = await getGroupedKeys('hash', 'bucket');
    expect(paths).toEqual([
      {
        title: 'EXTRA_LARGE/pdpPage',
        keys: [
          `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png`,
          `${pathPrefix}/EXTRA_LARGE/pdpPage/diff.png`,
          `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png`
        ]
      }
    ]);
  });

  it('returns keys where there is a new image but no base image', async () => {
    (getKeysFromS3 as jest.Mock).mockResolvedValue([
      `${pathPrefix}/EXTRA_LARGE/srpPage/base.png`,
      `${pathPrefix}/SMALL/pdpPage/new.png`,
      `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png`
    ]);
    const paths = await getGroupedKeys('hash', 'bucket');
    expect(paths).toEqual([
      {
        title: 'SMALL/pdpPage',
        keys: [`${pathPrefix}/SMALL/pdpPage/new.png`]
      }
    ]);
  });

  it('returns multiple pages', async () => {
    (getKeysFromS3 as jest.Mock).mockResolvedValue([
      `${pathPrefix}/EXTRA_LARGE/srpPage/base.png`,
      `${pathPrefix}/SMALL/srpPage/base.png`,
      `${pathPrefix}/SMALL/srpPage/diff.png`,
      `${pathPrefix}/SMALL/srpPage/new.png`,
      `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png`,
      `${pathPrefix}/EXTRA_LARGE/pdpPage/diff.png`,
      `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png`
    ]);
    const paths = await getGroupedKeys('hash', 'bucket');
    expect(paths).toEqual([
      {
        title: 'SMALL/srpPage',
        keys: [
          `${pathPrefix}/SMALL/srpPage/base.png`,
          `${pathPrefix}/SMALL/srpPage/diff.png`,
          `${pathPrefix}/SMALL/srpPage/new.png`
        ]
      },
      {
        title: 'EXTRA_LARGE/pdpPage',
        keys: [
          `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png`,
          `${pathPrefix}/EXTRA_LARGE/pdpPage/diff.png`,
          `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png`
        ]
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
      `${pathPrefix}/EXTRA_LARGE/srpPage/base.png`,
      `${pathPrefix}/SMALL/srpPage/base.png`,
      `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png`
    ]);
    await expect(() => getGroupedKeys('hash', 'bucket')).rejects.toThrow(
      'There was no new or diff images associated with the commit hash.\nThis might be because the tests failed before a picture could be taken and it could be compared to the base.'
    );
  });
});
