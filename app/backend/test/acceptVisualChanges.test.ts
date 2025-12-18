import {
  filterNewImages,
  updateBaseImages,
  getBaseImagePaths,
  acceptVisualChanges
} from '../src/acceptVisualChanges';
import { BASE_IMAGES_DIRECTORY, NEW_IMAGES_DIRECTORY } from 'shared';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

const copyS3FileMock = mock(() => Promise.resolve());
const s3ListMock = mock(() => Promise.resolve({ contents: [] }));
const listCommitStatusesForRefMock = mock(() => ({
  data: [
    {
      context: 'unit tests',
      state: 'success',
      created_at: '2023-05-02T19:11:02Z'
    }
  ]
}));
const updateCommitStatusMock = mock();

mock.module('../src/copyS3File', () => ({
  copyS3File: copyS3FileMock
}));

mock.module('../src/s3Client', () => ({
  s3Client: {
    list: s3ListMock
  }
}));

mock.module('../src/getOctokit', () => ({
  getOctokit: mock(() => ({
    rest: {
      repos: {
        listCommitStatusesForRef: listCommitStatusesForRefMock
      }
    }
  }))
}));

mock.module('../src/updateCommitStatus', () => ({
  updateCommitStatus: updateCommitStatusMock
}));

mock.module('@octokit/rest', () => ({
  Octokit: mock()
}));

beforeEach(() => {
  mock.clearAllMocks();
});

const pathPrefix = `${NEW_IMAGES_DIRECTORY}/030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5`;
describe('acceptVisualChanges', () => {
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
      expect(copyS3FileMock).toHaveBeenCalledWith(
        `${pathPrefix}/SMALL/pdpPage/new.png`,
        `${BASE_IMAGES_DIRECTORY}/SMALL/pdpPage/base.png`,
        expectedBucket
      );
      expect(copyS3FileMock).toHaveBeenCalledWith(
        `${pathPrefix}/SMALL/srpPage/new.png`,
        `${BASE_IMAGES_DIRECTORY}/SMALL/srpPage/base.png`,
        expectedBucket
      );
    });

    it('should throw error if other required checks have not yet passed', async () => {
      listCommitStatusesForRefMock.mockImplementationOnce(() => ({
        data: [
          {
            context: 'unit tests',
            state: 'success',
            created_at: '2023-05-02T19:11:02Z'
          },
          {
            context: 'other tests',
            state: 'failure',
            created_at: '2023-05-02T19:11:02Z'
          }
        ]
      }));

      const expectedBucket = 'expected-bucket-name';
      expect(
        acceptVisualChanges({
          commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
          bucket: expectedBucket,
          useBaseImages: true,
          repo: 'repo',
          owner: 'owner'
        })
      ).rejects.toThrow();

      expect(copyS3FileMock).not.toHaveBeenCalled();
      expect(updateCommitStatusMock).not.toHaveBeenCalled();
    });

    it('should update commit status but not base images if useBaseImages is false', async () => {
      const expectedBucket = 'expected-bucket-name';
      await acceptVisualChanges({
        commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
        bucket: expectedBucket,
        useBaseImages: false,
        repo: 'repo',
        owner: 'owner'
      });

      expect(copyS3FileMock).not.toHaveBeenCalled();
      expect(updateCommitStatusMock).toHaveBeenCalled();
    });
  });
});
