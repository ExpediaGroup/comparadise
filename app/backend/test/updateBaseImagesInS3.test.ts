import { S3Client } from '../src/s3Client';
import {
  filterNewImages,
  replaceImagesInS3,
  getBaseImagePaths,
  updateBaseImagesInS3
} from '../src/updateBaseImagesInS3';
import { BASE_IMAGES_DIRECTORY } from 'shared';
import { shouldAllowBaseImageUpdate } from '../src/shouldAllowBaseImageUpdate';

jest.mock('../src/shouldAllowBaseImageUpdate');
jest.mock('../src/s3Client');

describe('filterNewImages', () => {
  it('should filter only the new images from the given paths', () => {
    const newImage =
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/pdpPage/new.png';
    const diffImage =
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/pdpPage/diff.png';
    const images = filterNewImages([newImage, diffImage]);
    expect(images).toHaveLength(1);
    expect(images[0]).toBe(newImage);
  });

  it('should filter only the new images when many paths given', () => {
    const images = filterNewImages([
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/pdpPage/new.png',
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/pdpPage/diff.png',
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/LARGE/srpPage/new.png',
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/LARGE/pdpPage/base.png'
    ]);
    expect(images).toEqual([
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/pdpPage/new.png',
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/LARGE/srpPage/new.png'
    ]);
  });
});

describe('getBaseImagesPaths', () => {
  it('should return the base image paths given the new image paths', () => {
    const paths = [
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/pdpPage/new.png',
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/LARGE/srpPage/new.png'
    ];
    const result = getBaseImagePaths(paths);
    expect(result).toEqual([
      `${BASE_IMAGES_DIRECTORY}/SMALL/pdpPage/base.png`,
      `${BASE_IMAGES_DIRECTORY}/LARGE/srpPage/base.png`
    ]);
  });
});

describe('updateBaseImagesInS3', () => {
  it('should fetch the images from S3', async () => {
    const expectedBucket = 'expected-bucket-name';
    await replaceImagesInS3(
      [
        '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/pdpPage/new.png',
        '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/srpPage/new.png',
        '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/srpPage/base.png',
        '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/pdpPage/base.png'
      ],
      expectedBucket
    );
    expect(S3Client.copyObject).toHaveBeenCalledWith({
      Bucket: expectedBucket,
      CopySource: `${expectedBucket}/030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/pdpPage/new.png`,
      Key: `${BASE_IMAGES_DIRECTORY}/SMALL/pdpPage/base.png`,
      ACL: 'bucket-owner-full-control'
    });
    expect(S3Client.copyObject).toHaveBeenCalledWith({
      Bucket: expectedBucket,
      CopySource: `${expectedBucket}/030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5/SMALL/srpPage/new.png`,
      Key: `${BASE_IMAGES_DIRECTORY}/SMALL/srpPage/base.png`,
      ACL: 'bucket-owner-full-control'
    });
  });

  it('should throw error if other required checks have not yet passed', async () => {
    (shouldAllowBaseImageUpdate as jest.Mock).mockResolvedValue(false);

    const expectedBucket = 'expected-bucket-name';
    await expect(
      updateBaseImagesInS3({
        hash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
        bucket: expectedBucket,
        repo: 'repo',
        owner: 'owner'
      })
    ).rejects.toThrow();

    expect(S3Client.listObjectsV2).not.toHaveBeenCalled();
    expect(S3Client.copyObject).not.toHaveBeenCalled();
  });
});
