import { NEW_IMAGES_DIRECTORY } from 'shared';
import { getGroupedKeys } from '../src/getGroupedKeys';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

const listMock = mock(
  async (): Promise<{ contents: Array<{ key: string }> }> => ({
    contents: []
  })
);

mock.module('../src/s3Client', () => ({
  s3Client: {
    list: listMock
  }
}));

const pathPrefix = `${NEW_IMAGES_DIRECTORY}/hash`;

beforeEach(() => {
  mock.clearAllMocks();
});

describe('getGroupedKeys', () => {
  it('returns only the keys where there is a base, new, and diff', async () => {
    listMock.mockImplementationOnce(async () => ({
      contents: [
        { key: `${pathPrefix}/EXTRA_LARGE/srpPage/base.png` },
        { key: `${pathPrefix}/SMALL/srpPage/base.png` },
        { key: `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png` },
        { key: `${pathPrefix}/EXTRA_LARGE/pdpPage/diff.png` },
        { key: `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png` },
        { key: 'ome/actions-runner/something' }
      ]
    }));
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
    listMock.mockImplementationOnce(async () => ({
      contents: [
        { key: `${pathPrefix}/EXTRA_LARGE/srpPage/base.png` },
        { key: `${pathPrefix}/SMALL/pdpPage/new.png` },
        { key: `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png` }
      ]
    }));
    const paths = await getGroupedKeys('hash', 'bucket');
    expect(paths).toEqual([
      {
        title: 'SMALL/pdpPage',
        keys: [`${pathPrefix}/SMALL/pdpPage/new.png`]
      }
    ]);
  });

  it('returns multiple pages', async () => {
    listMock.mockImplementationOnce(async () => ({
      contents: [
        { key: `${pathPrefix}/EXTRA_LARGE/srpPage/base.png` },
        { key: `${pathPrefix}/SMALL/srpPage/base.png` },
        { key: `${pathPrefix}/SMALL/srpPage/diff.png` },
        { key: `${pathPrefix}/SMALL/srpPage/new.png` },
        { key: `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png` },
        { key: `${pathPrefix}/EXTRA_LARGE/pdpPage/diff.png` },
        { key: `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png` }
      ]
    }));
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
    listMock.mockImplementationOnce(async () => ({ contents: [] }));
    expect(getGroupedKeys('hash', 'bucket')).rejects.toThrow(
      'The commit hash was not associated with any visual regression test failures'
    );
  });

  it('tells us if there are no new or diff images associated with the commit hash', async () => {
    listMock.mockImplementationOnce(async () => ({
      contents: [
        { key: `${pathPrefix}/EXTRA_LARGE/srpPage/base.png` },
        { key: `${pathPrefix}/SMALL/srpPage/base.png` },
        { key: `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png` }
      ]
    }));
    expect(getGroupedKeys('hash', 'bucket')).rejects.toThrow(
      'There was no new or diff images associated with the commit hash.\nThis might be because the tests failed before a picture could be taken and it could be compared to the base.'
    );
  });
});
