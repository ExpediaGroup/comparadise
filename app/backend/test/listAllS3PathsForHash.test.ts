import { listAllS3PathsForHash } from '../src/listAllS3PathsForHash';
import { S3Client } from '../src/s3Client';

jest.mock('../src/s3Client');
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
