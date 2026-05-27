import { acceptVisualChanges } from '../src/acceptVisualChanges';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import type { S3Operations } from 'shared/s3';
import type { Octokit } from '@octokit/rest';

const updateBaseImagesMock = mock();

const makeS3 = (): Pick<S3Operations, 'updateBaseImages'> => ({
  updateBaseImages: updateBaseImagesMock
});

const listCommitStatusesForRefMock = mock(() => ({
  data: [
    {
      context: 'unit tests',
      state: 'success',
      created_at: '2023-05-02T19:11:02Z'
    }
  ]
}));

const createCommitStatusMock = mock(() => Promise.resolve());

const makeOctokit = (): Octokit =>
  ({
    rest: {
      repos: {
        listCommitStatusesForRef: listCommitStatusesForRefMock,
        createCommitStatus: createCommitStatusMock
      }
    }
  }) as unknown as Octokit;

describe('acceptVisualChanges', () => {
  afterEach(() => {
    mock.clearAllMocks();
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
      acceptVisualChanges(
        {
          commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
          bucket: expectedBucket,
          useBaseImages: true,
          repo: 'repo',
          owner: 'owner'
        },
        { urlParams: {} },
        makeS3(),
        makeOctokit()
      )
    ).rejects.toThrow();

    expect(updateBaseImagesMock).not.toHaveBeenCalled();
    expect(createCommitStatusMock).not.toHaveBeenCalled();
  });

  it('should not throw if other checks have not passed when useBaseImages is false', async () => {
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
    await acceptVisualChanges(
      {
        commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
        bucket: expectedBucket,
        useBaseImages: false,
        repo: 'repo',
        owner: 'owner'
      },
      { urlParams: {} },
      makeS3(),
      makeOctokit()
    );

    expect(updateBaseImagesMock).not.toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalled();
  });

  it('should update commit status but not base images if useBaseImages is false', async () => {
    const expectedBucket = 'expected-bucket-name';
    await acceptVisualChanges(
      {
        commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
        bucket: expectedBucket,
        useBaseImages: false,
        repo: 'repo',
        owner: 'owner'
      },
      { urlParams: {} },
      makeS3(),
      makeOctokit()
    );

    expect(updateBaseImagesMock).not.toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalled();
  });

  it('should call updateBaseImages and updateCommitStatus when useBaseImages is true', async () => {
    const expectedBucket = 'expected-bucket-name';
    await acceptVisualChanges(
      {
        commitHash: '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
        bucket: expectedBucket,
        useBaseImages: true,
        repo: 'repo',
        owner: 'owner'
      },
      { urlParams: {} },
      makeS3(),
      makeOctokit()
    );

    expect(updateBaseImagesMock).toHaveBeenCalledWith(
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
      expectedBucket
    );
    expect(createCommitStatusMock).toHaveBeenCalled();
  });
});
