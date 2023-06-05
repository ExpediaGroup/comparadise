import { listAllS3PathsForHash } from './listAllS3PathsForHash';
import { S3Client } from './s3Client';
import { expect } from '@jest/globals';

jest.mock('./s3Client');
(S3Client.listObjectsV2 as jest.Mock).mockResolvedValue({
  Contents: [
    {
      Key: 'ome/actions-runner/something'
    },
    {
      Key: 'a/normal/key'
    }
  ]
});

describe('listAllS3PathsForHash', () => {
  it('returns the response we want', async () => {
    const paths = await listAllS3PathsForHash('hash', 'bucket');
    expect(paths).toEqual(['a/normal/key']);
  });
});
