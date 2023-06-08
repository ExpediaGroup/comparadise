import { getImages } from '../src/getImages';
import { getBase64StringFromS3 } from '../src/getBase64StringFromS3';

jest.mock('../src/getBase64StringFromS3');

describe('getImages', () => {
  beforeEach(() => {
    (getBase64StringFromS3 as jest.Mock).mockResolvedValue('base64');
  });

  it('should get images from provided S3 keys', async () => {
    const result = await getImages({
      keys: [
        'hash/SMALL/srpPage/base.png',
        'hash/SMALL/srpPage/diff.png',
        'hash/SMALL/srpPage/new.png'
      ],
      bucket: 'bucket'
    });
    expect(result).toEqual([
      {
        path: 'SMALL/srpPage',
        name: 'base',
        image: 'base64'
      },
      {
        path: 'SMALL/srpPage',
        name: 'diff',
        image: 'base64'
      },
      {
        path: 'SMALL/srpPage',
        name: 'new',
        image: 'base64'
      }
    ])
  });
});
