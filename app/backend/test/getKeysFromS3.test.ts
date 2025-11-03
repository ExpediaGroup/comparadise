import { getKeysFromS3 } from '../src/getKeysFromS3';
import { describe, expect, it, mock } from 'bun:test';

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
  it('returns the response we want', async () => {
    const paths = await getKeysFromS3('hash', 'bucket');
    expect(paths).toEqual(['a/normal/key']);
  });
});
