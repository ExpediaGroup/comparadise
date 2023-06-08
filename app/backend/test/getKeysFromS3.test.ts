import { getKeysFromS3 } from '../src/getKeysFromS3';
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
    const paths = await getKeysFromS3('hash', 'bucket');
    expect(paths).toEqual(['a/normal/key']);
  });
});
