import { getKeysFromS3 } from '../src/getKeysFromS3';
import { afterEach, describe, expect, it, mock } from 'bun:test';

const listObjectsV2Mock = mock(() => ({
  Contents: [
    {
      Key: 'ome/actions-runner/something'
    },
    {
      Key: 'a/normal/key'
    }
  ]
}));
mock.module('../src/s3Client', () => ({
  S3Client: {
    listObjectsV2: listObjectsV2Mock
  }
}));

describe('listAllS3PathsForHash', () => {
  afterEach(() => {
    listObjectsV2Mock.mockClear();
  });

  it('returns the response we want', async () => {
    const paths = await getKeysFromS3('new-images', 'hash', 'bucket');
    expect(paths).toEqual(['a/normal/key']);
  });

  it('paginates when results are truncated', async () => {
    listObjectsV2Mock
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

    expect(listObjectsV2Mock).toHaveBeenCalledTimes(2);
    expect(listObjectsV2Mock).toHaveBeenNthCalledWith(1, {
      Bucket: 'bucket',
      Prefix: 'new-images/hash/'
    });
    expect(listObjectsV2Mock).toHaveBeenNthCalledWith(2, {
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
