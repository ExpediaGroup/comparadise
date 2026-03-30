import { getKeysFromS3 } from 'shared/s3';
import { afterEach, describe, expect, it, mock } from 'bun:test';

const listObjectsMock = mock(() => ({
  Contents: [
    {
      Key: 'ome/actions-runner/something'
    },
    {
      Key: 'a/normal/key'
    }
  ]
}));
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

describe('listAllS3PathsForHash', () => {
  afterEach(() => {
    listObjectsMock.mockClear();
  });

  it('returns the response we want', async () => {
    const paths = await getKeysFromS3('new-images', 'hash', 'bucket');
    expect(paths).toEqual(['a/normal/key']);
  });

  it('paginates when results are truncated', async () => {
    listObjectsMock
      .mockImplementationOnce(() => ({
        Contents: [{ Key: 'new-images/hash/page1/new.png' }],
        IsTruncated: true,
        NextContinuationToken: 'token-1'
      }))
      .mockImplementationOnce(() => ({
        Contents: [{ Key: 'new-images/hash/page2/new.png' }],
        IsTruncated: false
      }));

    const paths = await getKeysFromS3('new-images', 'hash', 'bucket');

    expect(listObjectsMock).toHaveBeenCalledTimes(2);
    expect(listObjectsMock).toHaveBeenNthCalledWith(1, {
      Bucket: 'bucket',
      Prefix: 'new-images/hash/'
    });
    expect(listObjectsMock).toHaveBeenNthCalledWith(2, {
      Bucket: 'bucket',
      Prefix: 'new-images/hash/',
      ContinuationToken: 'token-1'
    });
    expect(paths).toEqual([
      'new-images/hash/page1/new.png',
      'new-images/hash/page2/new.png'
    ]);
  });
});
