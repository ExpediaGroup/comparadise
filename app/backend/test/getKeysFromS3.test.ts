import { getKeysFromS3 } from '../src/getKeysFromS3';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

const listMock = mock(async () => ({
  contents: [{ key: 'ome/actions-runner/something' }, { key: 'a/normal/key' }]
}));

mock.module('../src/s3Client', () => ({
  s3Client: {
    list: listMock
  }
}));

beforeEach(() => {
  mock.clearAllMocks();
});

describe('listAllS3PathsForHash', () => {
  it('returns the response we want', async () => {
    const paths = await getKeysFromS3('hash', 'bucket');
    expect(paths).toEqual(['a/normal/key']);
  });
});
