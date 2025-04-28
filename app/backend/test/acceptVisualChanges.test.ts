import { S3Client } from '../src/s3Client';
import {
  filterNewImages,
  updateBaseImages,
  getBaseImagePaths,
  acceptVisualChanges
} from '../src/acceptVisualChanges';
import { BASE_IMAGES_DIRECTORY, NEW_IMAGES_DIRECTORY } from 'shared';
import { findReasonToPreventVisualChangeAcceptance } from '../src/findReasonToPreventVisualChangeAcceptance';
import { updateCommitStatus } from '../src/updateCommitStatus';
import { expect } from '@jest/globals';

jest.mock('../src/findReasonToPreventVisualChangeAcceptance');
jest.mock('../src/s3Client');
jest.mock('../src/updateCommitStatus');
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn()
}));

const pathPrefix = `${NEW_IMAGES_DIRECTORY}/030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5`;
describe('filterNewImages', () => {
  it('should filter only the new images from the given paths', () => {
    const newImage = `${pathPrefix}/SMALL/pdpPage/new.png`;
    const diffImage = `${pathPrefix}/SMALL/pdpPage/diff.png`;
    const images = filterNewImages([newImage, diffImage]);
    expect(images).toHaveLength(1);
    expect(images[0]).toBe(newImage);
  });

  it('should filter only the new images when many paths given', () => {
    const images = filterNewImages([
      `${pathPrefix}/SMALL/pdpPage/new.png`,
      `${pathPrefix}/SMALL/pdpPage/diff.png`,
      `${pathPrefix}/LARGE/srpPage/new.png`,
      `${pathPrefix}/LARGE/pdpPage/base.png`
    ]);
    expect(images).toEqual([
      `${pathPrefix}/SMALL/pdpPage/new.png`,
      `${pathPrefix}/LARGE/srpPage/new.png`
    ]);
  });
});

describe('getBaseImagesPaths', () => {
  it('should return the base image paths given the new image paths', () => {
    const paths = [
      `${pathPrefix}/SMALL/pdpPage/new.png`,
      `${pathPrefix}/LARGE/srpPage/new.png`
    ];
    const result = getBaseImagePaths(paths);
    expect(result).toEqual([
      `${BASE_IMAGES_DIRECTORY}/SMALL/pdpPage/base.png`,
      `${BASE_IMAGES_DIRECTORY}/LARGE/srpPage/base.png`
    ]);
  });
});

describe('acceptVisualChanges', () => {
  it('should fetch the images from S3', async () => {
    const expectedBucket = 'expected-bucket-name';
    await updateBaseImages(
      [
        `${pathPrefix}/SMALL/pdpPage/new.png`,
        `${pathPrefix}/SMALL/srpPage/new.png`,
        `${pathPrefix}/SMALL/srpPage/base.png`,
        `${pathPrefix}/SMALL/pdpPage/base.png`
      ],
      expectedBucket
    );
    expect(S3Client.copyObject).toHaveBeenCalledWith({
      Bucket: expectedBucket,
      CopySource: `${expectedBucket}/${pathPrefix}/SMALL/pdpPage/new.png`,
      Key: `${BASE_IMAGES_DIRECTORY}/SMALL/pdpPage/base.png`,
      ACL: 'bucket-owner-full-control'
    });
    expect(S3Client.copyObject).toHaveBeenCalledWith({
      Bucket: expectedBucket,
      CopySource: `${expectedBucket}/${pathPrefix}/SMALL/srpPage/new.png`,
      Key: `${BASE_IMAGES_DIRECTORY}/SMALL/srpPage/base.png`,
      ACL: 'bucket-owner-full-control'
    });
  });

  it('should throw error if other required checks have not yet passed', async () => {
    (findReasonToPreventVisualChangeAcceptance as jest.Mock).mockResolvedValue(
      'Some reason to prevent update'
    );

    const expectedBucket = 'expected-bucket-name';
    await expect(
      acceptVisualChanges({
        commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
        bucket: expectedBucket,
        useBaseImages: true,
        repo: 'repo',
        owner: 'owner'
      })
    ).rejects.toThrow();

    expect(S3Client.listObjectsV2).not.toHaveBeenCalled();
    expect(S3Client.copyObject).not.toHaveBeenCalled();
    expect(updateCommitStatus).not.toHaveBeenCalled();
  });

  it('should update commit status but not base images if useBaseImages is false', async () => {
    (findReasonToPreventVisualChangeAcceptance as jest.Mock).mockResolvedValue(
      undefined
    );
    const expectedBucket = 'expected-bucket-name';
    await acceptVisualChanges({
      commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
      bucket: expectedBucket,
      useBaseImages: false,
      repo: 'repo',
      owner: 'owner'
    });

    expect(S3Client.listObjectsV2).not.toHaveBeenCalled();
    expect(S3Client.copyObject).not.toHaveBeenCalled();
    expect(updateCommitStatus).toHaveBeenCalled();
  });
});
