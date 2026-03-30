import { acceptVisualChanges } from '../src/acceptVisualChanges';

import { afterEach, describe, expect, it, mock } from 'bun:test';

const copyObjectMock = mock();
const updateBaseImagesMock = mock();
mock.module('shared/s3', () => ({
  s3Client: {},
  listObjects: mock(),
  listAllObjects: mock(),
  getKeysFromS3: mock(),
  updateBaseImages: updateBaseImagesMock,
  getObject: mock(),
  putObject: mock(),
  copyObject: copyObjectMock
}));

const listCommitStatusesForRefMock = mock(() => ({
  data: [
    {
      context: 'unit tests',
      state: 'success',
      created_at: '2023-05-02T19:11:02Z'
    }
  ]
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
const updateCommitStatusMock = mock();
mock.module('../src/updateCommitStatus', () => ({
  updateCommitStatus: updateCommitStatusMock
}));
mock.module('@octokit/rest', () => ({
  Octokit: mock()
}));

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
        { urlParams: {} }
      )
    ).rejects.toThrow();

    expect(updateBaseImagesMock).not.toHaveBeenCalled();
    expect(updateCommitStatusMock).not.toHaveBeenCalled();
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
      { urlParams: {} }
    );

    expect(updateBaseImagesMock).not.toHaveBeenCalled();
    expect(updateCommitStatusMock).toHaveBeenCalled();
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
      { urlParams: {} }
    );

    expect(updateBaseImagesMock).toHaveBeenCalledWith(
      '030928b2c4b48ab4d3b57c8e0b0f7a56db768ef5',
      expectedBucket
    );
    expect(updateCommitStatusMock).toHaveBeenCalled();
  });
});
