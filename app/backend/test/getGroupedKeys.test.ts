import { NEW_IMAGES_DIRECTORY } from 'shared/constants';
import { getGroupedKeys } from '../src/getGroupedKeys';
import { describe, expect, it, mock } from 'bun:test';

const listObjectsMock = mock();
mock.module('shared/s3', () => ({
  s3Client: {},
  listObjects: listObjectsMock,
  listAllObjects,
  getKeysFromS3,
  filterNewImages: mock(),
  toBaseImagePath: mock(),
  getBaseImagePaths: mock(),
  getBaseImagePathsFromOriginal: mock(),
  encodeS3CopySource: mock(),
  updateBaseImages: mock(),
  getObject: mock(),
  putObject: mock(),
  copyObject: mock()
}));

async function getKeysFromS3(directory: string, hash: string, bucket: string) {
  const allContents = await listAllObjects({
    Bucket: bucket,
    Prefix: `${directory}/${hash}/`
  });
  const keys = allContents.map(
    (content: { Key?: string }) => content.Key ?? ''
  );
  return keys.filter(
    (path: string) => path && !path.includes('actions-runner')
  );
}

async function listAllObjects(
  input: { Bucket: string; Prefix: string; ContinuationToken?: string },
  continuationToken?: string
) {
  const response = await listObjectsMock({
    ...input,
    ...(continuationToken && { ContinuationToken: continuationToken })
  });
  const contents = response.Contents ?? [];
  if (!response.IsTruncated) return contents;
  return [
    ...contents,
    ...(await listAllObjects(input, response.NextContinuationToken))
  ];
}

const pathPrefix = `${NEW_IMAGES_DIRECTORY}/hash`;

describe('getGroupedKeys', () => {
  it('returns only the keys where there is a base, new, and diff', async () => {
    listObjectsMock.mockImplementationOnce(() => ({
      Contents: [
        { Key: `${pathPrefix}/EXTRA_LARGE/srpPage/base.png` },
        { Key: `${pathPrefix}/SMALL/srpPage/base.png` },
        { Key: `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png` },
        { Key: `${pathPrefix}/EXTRA_LARGE/pdpPage/diff.png` },
        { Key: `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png` },
        { Key: 'ome/actions-runner/something' }
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
    listObjectsMock.mockImplementationOnce(() => ({
      Contents: [
        { Key: `${pathPrefix}/EXTRA_LARGE/srpPage/base.png` },
        { Key: `${pathPrefix}/SMALL/pdpPage/new.png` },
        { Key: `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png` }
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
    listObjectsMock.mockImplementationOnce(() => ({
      Contents: [
        { Key: `${pathPrefix}/EXTRA_LARGE/srpPage/base.png` },
        { Key: `${pathPrefix}/SMALL/srpPage/base.png` },
        { Key: `${pathPrefix}/SMALL/srpPage/diff.png` },
        { Key: `${pathPrefix}/SMALL/srpPage/new.png` },
        { Key: `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png` },
        { Key: `${pathPrefix}/EXTRA_LARGE/pdpPage/diff.png` },
        { Key: `${pathPrefix}/EXTRA_LARGE/pdpPage/new.png` }
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
    listObjectsMock.mockImplementationOnce(() => ({ Contents: [] }));
    expect(getGroupedKeys('hash', 'bucket')).rejects.toThrow(
      'The commit hash was not associated with any visual regression test failures'
    );
  });

  it('tells us if there are no new or diff images associated with the commit hash', async () => {
    listObjectsMock.mockImplementationOnce(() => ({
      Contents: [
        { Key: `${pathPrefix}/EXTRA_LARGE/srpPage/base.png` },
        { Key: `${pathPrefix}/SMALL/srpPage/base.png` },
        { Key: `${pathPrefix}/EXTRA_LARGE/pdpPage/base.png` }
      ]
    }));
    expect(getGroupedKeys('hash', 'bucket')).rejects.toThrow(
      'There was no new or diff images associated with the commit hash.\nThis might be because the tests failed before a screenshot could be taken and it could be compared to the base.'
    );
  });
});
