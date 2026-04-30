import {
  VISUAL_REGRESSION_CONTEXT,
  VISUAL_TESTS_FAILED_TO_EXECUTE
} from 'shared/constants';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import path from 'path';

const disableAutoMergeMock = mock();
mock.module('../src/disable-auto-merge', () => ({
  disableAutoMerge: disableAutoMergeMock
}));

const globMock = mock();
mock.module('glob', () => ({
  glob: globMock
}));

const getInputMock = mock();
const getBooleanInputMock = mock();
const getMultilineInputMock = mock();
const setFailedMock = mock();
const warningMock = mock();
mock.module('@actions/core', () => ({
  info: mock(),
  getInput: getInputMock,
  getBooleanInput: getBooleanInputMock,
  getMultilineInput: getMultilineInputMock,
  setFailed: setFailedMock,
  warning: warningMock
}));

const execMock = mock();
mock.module('@actions/exec', () => ({
  exec: execMock
}));

const unlinkSyncMock = mock();
const createWriteStreamMock = mock();
const mkdirMock = mock();
const readFileMock = mock();
mock.module('fs', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const actualFs = require('fs');
  return {
    ...actualFs,
    unlinkSync: unlinkSyncMock,
    createWriteStream: createWriteStreamMock,
    promises: {
      mkdir: mkdirMock,
      readFile: readFileMock
    }
  };
});

const rmMock = mock();
mock.module('fs/promises', () => ({
  rm: rmMock
}));

const listObjectsMock = mock();
const getObjectMock = mock();
const putObjectMock = mock();
const copyObjectMock = mock();
const deleteObjectsMock = mock();
const getKeysFromS3Mock = mock();
const updateBaseImagesMock = mock();
async function listAllObjects(
  input: { Bucket: string; Prefix: string },
  continuationToken?: string
): Promise<{ Key?: string }[]> {
  const response = await listObjectsMock({
    ...input,
    ...(continuationToken && { ContinuationToken: continuationToken })
  });
  const contents = response.Contents ?? [];
  if (!response.IsTruncated) return contents;
  return [
    ...contents,
    ...(await listAllObjects(input, response.NextContinuationToken))
  ];
}
mock.module('shared/s3', () => ({
  s3Client: {},
  listObjects: listObjectsMock,
  listAllObjects,
  getKeysFromS3: getKeysFromS3Mock,
  updateBaseImages: updateBaseImagesMock,
  getObject: getObjectMock,
  putObject: putObjectMock,
  copyObject: copyObjectMock,
  deleteObjects: deleteObjectsMock
}));

const jimpImageMock = {
  width: 400,
  height: 300,
  resize: mock(),
  getBuffer: mock()
};
const jimpReadMock = mock();
mock.module('jimp', () => ({
  Jimp: { read: jimpReadMock }
}));

const createCommitStatusMock = mock();
const listPullRequestsAssociatedWithCommitMock = mock(() => ({
  data: [{ number: 123 }]
}));
const listCommitStatusesForRefMock = mock(() => ({
  data: [
    {
      context: 'some context',
      state: 'success'
    }
  ]
}));
const createCommentMock = mock();
const listCommentsMock = mock(() => ({ data: [{ id: 1 }] }));
const githubContext = {
  repo: { repo: 'repo', owner: 'owner' },
  runAttempt: 1
};
mock.module('@actions/github', () => ({
  context: githubContext,
  getOctokit: mock(() => ({
    rest: {
      repos: {
        createCommitStatus: createCommitStatusMock,
        listPullRequestsAssociatedWithCommit:
          listPullRequestsAssociatedWithCommitMock,
        listCommitStatusesForRef: listCommitStatusesForRefMock
      },
      issues: {
        createComment: createCommentMock,
        listComments: listCommentsMock
      }
    }
  }))
}));

mock.module('../src/octokit', () => ({
  octokit: {
    rest: {
      repos: {
        createCommitStatus: createCommitStatusMock,
        listPullRequestsAssociatedWithCommit:
          listPullRequestsAssociatedWithCommitMock,
        listCommitStatusesForRef: listCommitStatusesForRefMock
      },
      issues: {
        createComment: createCommentMock,
        listComments: listCommentsMock
      }
    }
  }
}));

// A Readable subclass whose pipe() immediately triggers 'finish' on the destination
class MockReadable extends Readable {
  _read() {}
  pipe<T extends NodeJS.WritableStream>(dest: T): T {
    process.nextTick(() => (dest as unknown as EventEmitter).emit('finish'));
    return dest;
  }
}

const inputMap: Record<string, string> = {
  'screenshots-directory': 'path/to/screenshots',
  'bucket-name': 'some-bucket',
  'commit-hash': 'sha',
  'github-token': 'some-token',
  'comparadise-host': 'https://comparadise.app'
};

const diffIdInputMap: Record<string, string | undefined> = {
  ...inputMap,
  'diff-id': 'uniqueId',
  'commit-hash': undefined
};

// Helper to assert no calls to `octokit.rest` methods
const assertNoOctokitCalls = () => {
  const allMethods = [
    createCommitStatusMock,
    listPullRequestsAssociatedWithCommitMock,
    listCommitStatusesForRefMock,
    createCommentMock,
    listCommentsMock
  ];
  allMethods.forEach(method => {
    expect(method).not.toHaveBeenCalled();
  });
};

async function runAction() {
  const { run } = await import('../src/run');
  await run();
}

describe('main', () => {
  beforeEach(() => {
    githubContext.runAttempt = 1;

    getInputMock.mockImplementation(name => inputMap[name]);

    getBooleanInputMock.mockImplementation(name =>
      name === 'visual-test-command-fails-on-diff' ? true : undefined
    );

    const multiLineInputMap: Record<string, string[]> = {
      'visual-test-command': ['run my visual tests']
    };
    getMultilineInputMock.mockImplementation(name => multiLineInputMap[name]);

    listObjectsMock.mockResolvedValue({ Contents: [] });
    getObjectMock.mockResolvedValue({ Body: null });
    putObjectMock.mockResolvedValue({});
    copyObjectMock.mockResolvedValue({});
    deleteObjectsMock.mockResolvedValue({});
    getKeysFromS3Mock.mockResolvedValue([]);
    updateBaseImagesMock.mockResolvedValue(undefined);
    mkdirMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(Buffer.from('image-data'));
    createWriteStreamMock.mockReturnValue(new EventEmitter());
    jimpReadMock.mockResolvedValue(jimpImageMock);
    jimpImageMock.resize.mockReturnValue(jimpImageMock);
    jimpImageMock.getBuffer.mockResolvedValue(Buffer.from('resized-image'));

    // Mock fs operations
    unlinkSyncMock.mockReturnValue(undefined);
    rmMock.mockResolvedValue(undefined);

    globMock.mockResolvedValue([]);
  });

  afterEach(() => {
    mock.clearAllMocks();
  });

  it('should fail when neither diff-id nor commit-hash is provided', async () => {
    const extendedInputMap: Record<string, string | undefined> = {
      ...inputMap,
      'diff-id': undefined,
      'commit-hash': undefined
    };
    getInputMock.mockImplementation(name => extendedInputMap[name]);
    execMock.mockResolvedValue(0);
    await runAction();
    expect(setFailedMock).toHaveBeenCalledWith(
      'Please provide either a commit-hash or a diff-id.'
    );
  });

  it('should fail if visual tests fail', async () => {
    execMock.mockResolvedValue(1);
    await runAction();
    expect(setFailedMock).toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'failure',
      description: VISUAL_TESTS_FAILED_TO_EXECUTE
    });
  });

  it('should fail if visual tests fail with diff-id input', async () => {
    getInputMock.mockImplementation(name => diffIdInputMap[name]);
    execMock.mockResolvedValue(1);
    await runAction();
    expect(setFailedMock).toHaveBeenCalled();
    assertNoOctokitCalls();
  });

  it('should pick commit-hash when both commit-hash and diff-id are provided', async () => {
    const extendedInputMap: Record<string, string> = {
      ...inputMap,
      'diff-id': '12345',
      'commit-hash': 'sha'
    };
    getInputMock.mockImplementation(name => extendedInputMap[name]);
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/base.png']);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'success',
      description: 'Visual tests passed!'
    });
  });

  it('should pass when only diff-id is provided', async () => {
    getInputMock.mockImplementation(name => diffIdInputMap[name]);
    execMock.mockResolvedValue(0);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
  });

  it('should pass if visual tests pass and no diffs or new images', async () => {
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/base.png']);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'success',
      description: 'Visual tests passed!'
    });
  });

  it('should pass if visual tests pass and no diffs or new images with diff-id input', async () => {
    getInputMock.mockImplementation(name => diffIdInputMap[name]);
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/base.png']);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
    assertNoOctokitCalls();
  });

  it('should fail if visual tests pass and some diff images were created', async () => {
    execMock.mockResolvedValue(1);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png',
      'path/to/another-screenshot/diff.png'
    ]);
    await runAction();
    expect(setFailedMock).toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalledWith(
      'path/to/screenshots/diff.png'
    );
    expect(unlinkSyncMock).toHaveBeenCalledWith(
      'path/to/another-screenshot/diff.png'
    );
    expect(createCommitStatusMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'pending',
      description: 'Visual diffs found.',
      target_url: expect.any(String)
    });
    expect(createCommentMock).toHaveBeenCalled();
  });

  it('should fail if visual tests pass and some diff images were created', async () => {
    getInputMock.mockImplementation(name => diffIdInputMap[name]);
    execMock.mockResolvedValue(1);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png',
      'path/to/another-screenshot/diff.png'
    ]);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalledWith(
      'path/to/screenshots/diff.png'
    );
    expect(unlinkSyncMock).toHaveBeenCalledWith(
      'path/to/another-screenshot/diff.png'
    );
    assertNoOctokitCalls();
  });

  it('should fail if some visual tests fail and some diff images were created', async () => {
    const multiLineInputMapMultipleCommands: Record<string, string[]> = {
      'visual-test-command': ['run my visual tests', 'ok thank you']
    };
    getMultilineInputMock.mockImplementation(
      name => multiLineInputMapMultipleCommands[name]
    );
    execMock.mockResolvedValue(1);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(setFailedMock).toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'failure',
      description: VISUAL_TESTS_FAILED_TO_EXECUTE
    });
  });

  it('should fail if some visual tests fail and some diff images were created with diff-id input', async () => {
    getInputMock.mockImplementation(name => diffIdInputMap[name]);
    const multiLineInputMapMultipleCommands: Record<string, string[]> = {
      'visual-test-command': ['run my visual tests', 'ok thank you']
    };
    getMultilineInputMock.mockImplementation(
      name => multiLineInputMapMultipleCommands[name]
    );
    execMock.mockResolvedValue(1);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(setFailedMock).toHaveBeenCalled();
    assertNoOctokitCalls();
  });

  it('should pass if visual tests initially fail but pass on retry', async () => {
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/diff.png']);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).toHaveBeenCalledWith('path/to/screenshots/diff.png');
    expect(createCommitStatusMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'success',
      description: 'Visual tests passed!'
    });
  });

  it('should pass if visual tests initially fail but pass on retry with diff-id input', async () => {
    getInputMock.mockImplementation(name => diffIdInputMap[name]);
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/diff.png']);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).toHaveBeenCalledWith('path/to/screenshots/diff.png');
    assertNoOctokitCalls();
  });

  it('should set pending status and upload to new-images if visual tests pass and only new images were created', async () => {
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue([
      'path/to/screenshots/existingTest/base.png',
      'path/to/screenshots/newTest1/new.png',
      'path/to/screenshots/newTest2/new.png'
    ]);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
    expect(warningMock).toHaveBeenCalledWith(
      'Visual diffs found and new visual tests created.'
    );
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: expect.stringContaining('new-images/sha/')
      })
    );
    expect(createCommitStatusMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'pending',
      description: 'Visual diffs found and new visual tests created.',
      target_url: expect.any(String)
    });
    expect(createCommentMock).toHaveBeenCalled();
  });

  it('should set pending status and upload to new-images if visual tests pass and only new images were created with diff-id input', async () => {
    getInputMock.mockImplementation(name => diffIdInputMap[name]);
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue([
      'path/to/screenshots/existingTest/base.png',
      'path/to/screenshots/newTest1/new.png',
      'path/to/screenshots/newTest2/new.png'
    ]);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: expect.stringContaining('new-images/uniqueId/')
      })
    );
    assertNoOctokitCalls();
  });

  it('should use subdirectories if provided', async () => {
    execMock.mockResolvedValue(0);
    const extendedInputMap: Record<string, string> = {
      ...inputMap,
      'package-paths': 'path/1,path/2'
    };
    getInputMock.mockImplementation(name => extendedInputMap[name]);
    globMock.mockResolvedValue([
      'path/to/screenshots/path/1/component/base.png',
      'path/to/screenshots/path/1/component/diff.png',
      'path/to/screenshots/path/1/component/new.png',
      'path/to/screenshots/path/2/component/base.png'
    ]);
    await runAction();
    expect(listObjectsMock).toHaveBeenCalledWith(
      expect.objectContaining({ Prefix: 'base-images/' })
    );
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: expect.stringContaining('new-images/sha/')
      })
    );
    expect(createCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('| path/1 | 1 | 0 |')
      })
    );
  });

  it('should use subdirectories if provided with diff-id input', async () => {
    execMock.mockResolvedValue(0);
    const extendedInputMap: Record<string, string> = {
      ...diffIdInputMap,
      'package-paths': 'path/1,path/2'
    };
    getInputMock.mockImplementation(name => extendedInputMap[name]);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(listObjectsMock).toHaveBeenCalledWith(
      expect.objectContaining({ Prefix: 'base-images/' })
    );
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: expect.stringContaining('new-images/uniqueId/')
      })
    );
    assertNoOctokitCalls();
  });

  it('should download base images if use-base-images specified as true', async () => {
    execMock.mockResolvedValue(0);
    getInputMock.mockImplementation(name => inputMap[name]);
    getBooleanInputMock.mockImplementation(() => true);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(listObjectsMock).toHaveBeenCalledWith(
      expect.objectContaining({ Prefix: 'base-images/' })
    );
  });

  it('should not download base images if use-base-images specified as false and set URL param', async () => {
    execMock.mockResolvedValue(0);
    getInputMock.mockImplementation(name => inputMap[name]);
    getBooleanInputMock.mockImplementation(() => false);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(listObjectsMock).not.toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'pending',
      description: 'Visual diffs found.',
      target_url: expect.any(String)
    });
  });

  it('should not download base images if prefix does not exist', async () => {
    execMock.mockResolvedValue(0);
    getBooleanInputMock.mockReturnValue(true); // Ensure use-base-images is true
    const extendedInputMap: Record<string, string> = {
      ...inputMap,
      'package-paths': 'path/1,path/2'
    };
    getInputMock.mockImplementation(name => extendedInputMap[name]);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(listObjectsMock).toHaveBeenCalledWith(
      expect.objectContaining({ Prefix: 'base-images/' })
    );
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: expect.stringContaining('new-images/sha/')
      })
    );
  });

  it('should not set successful commit status or create comment if the latest Visual Regression status is failure', async () => {
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/base.png']);
    listCommitStatusesForRefMock.mockImplementationOnce(() => ({
      data: [
        {
          context: 'some context',
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T16:51:29Z',
          state: 'failure',
          description: 'A visual regression was detected!'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T15:51:29Z',
          state: 'success'
        }
      ]
    }));
    await runAction();
    expect(createCommitStatusMock).not.toHaveBeenCalled();
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('should not set successful commit status if the latest Visual Regression status has been set', async () => {
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/base.png']);
    listCommitStatusesForRefMock.mockImplementationOnce(() => ({
      data: [
        {
          context: 'some context',
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T15:51:29Z',
          state: 'success'
        }
      ]
    }));
    await runAction();
    expect(createCommitStatusMock).not.toHaveBeenCalled();
  });

  it('should not set commit status or create comment if the latest Visual Regression status is failure because tests failed to execute successfully', async () => {
    execMock.mockResolvedValue(1);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    listCommitStatusesForRefMock.mockImplementationOnce(() => ({
      data: [
        {
          context: 'some context',
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T16:51:29Z',
          state: 'failure',
          description: VISUAL_TESTS_FAILED_TO_EXECUTE
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T15:51:29Z',
          state: 'success'
        }
      ]
    }));
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
    expect(createCommitStatusMock).not.toHaveBeenCalled();
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('should set successful commit status (and disable auto merge) if a visual test failed to execute but this is a re-run', async () => {
    githubContext.runAttempt = 2;
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/base.png']);
    listCommitStatusesForRefMock.mockImplementationOnce(() => ({
      data: [
        {
          context: 'some context',
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T16:51:29Z',
          state: 'failure',
          description: VISUAL_TESTS_FAILED_TO_EXECUTE
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T15:51:29Z',
          state: 'success'
        }
      ]
    }));
    await runAction();
    expect(disableAutoMergeMock).toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalled();
  });

  it('should set failure commit status (and not disable auto merge) if a visual test failed to execute but this is a re-run', async () => {
    githubContext.runAttempt = 2;
    execMock.mockResolvedValue(1);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    listCommitStatusesForRefMock.mockImplementationOnce(() => ({
      data: [
        {
          context: 'some context',
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T16:51:29Z',
          state: 'failure',
          description: VISUAL_TESTS_FAILED_TO_EXECUTE
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T15:51:29Z',
          state: 'success'
        }
      ]
    }));
    await runAction();
    expect(disableAutoMergeMock).not.toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalled();
  });

  it('should delete S3 images for hash when tests pass on retry', async () => {
    githubContext.runAttempt = 2;
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/base.png']);
    getKeysFromS3Mock.mockResolvedValueOnce([
      'new-images/sha/component/new.png'
    ]);
    getKeysFromS3Mock.mockResolvedValueOnce([]);
    await runAction();
    expect(deleteObjectsMock).toHaveBeenCalledWith({
      Bucket: 'some-bucket',
      Delete: {
        Objects: [{ Key: 'new-images/sha/component/new.png' }],
        Quiet: true
      }
    });
  });

  it('should delete S3 images for hash when tests pass on retry with diff-id input', async () => {
    githubContext.runAttempt = 2;
    getInputMock.mockImplementation(name => diffIdInputMap[name]);
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/base.png']);
    getKeysFromS3Mock.mockResolvedValueOnce([
      'new-images/uniqueId/component/new.png'
    ]);
    getKeysFromS3Mock.mockResolvedValueOnce([]);
    await runAction();
    expect(deleteObjectsMock).toHaveBeenCalledWith({
      Bucket: 'some-bucket',
      Delete: {
        Objects: [{ Key: 'new-images/uniqueId/component/new.png' }],
        Quiet: true
      }
    });
  });

  it('should not delete S3 images when tests pass on first attempt', async () => {
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/base.png']);
    await runAction();
    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });

  it('should skip deletion when no images exist in S3 on retry', async () => {
    githubContext.runAttempt = 2;
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/base.png']);
    getKeysFromS3Mock.mockResolvedValue([]);
    await runAction();
    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });

  it('should only delete S3 images scoped to package-paths on retry', async () => {
    githubContext.runAttempt = 2;
    const extendedInputMap: Record<string, string> = {
      ...inputMap,
      'package-paths': 'pkg1'
    };
    getInputMock.mockImplementation(name => extendedInputMap[name]);
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue(['path/to/screenshots/pkg1/base.png']);
    getKeysFromS3Mock.mockResolvedValueOnce([
      'new-images/sha/pkg1/component/new.png',
      'new-images/sha/pkg2/component/new.png'
    ]);
    getKeysFromS3Mock.mockResolvedValueOnce([
      'original-new-images/sha/pkg1/component/new.png',
      'original-new-images/sha/pkg2/component/new.png'
    ]);
    await runAction();
    expect(deleteObjectsMock).toHaveBeenCalledWith({
      Bucket: 'some-bucket',
      Delete: {
        Objects: [
          { Key: 'new-images/sha/pkg1/component/new.png' },
          { Key: 'original-new-images/sha/pkg1/component/new.png' }
        ],
        Quiet: true
      }
    });
  });

  it('should call setFailed with the diff message when visual-test-command-fails-on-diff is true', async () => {
    execMock.mockResolvedValue(0);
    getBooleanInputMock.mockImplementation(name =>
      name === 'visual-test-command-fails-on-diff' ? true : undefined
    );
    globMock.mockResolvedValue([
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(setFailedMock).toHaveBeenCalledWith('Visual diffs found.');
    expect(warningMock).not.toHaveBeenCalledWith('Visual diffs found.');
  });

  it('should call warning instead of setFailed when visual-test-command-fails-on-diff is false', async () => {
    execMock.mockResolvedValue(0);
    getBooleanInputMock.mockImplementation(name =>
      name === 'visual-test-command-fails-on-diff' ? false : undefined
    );
    globMock.mockResolvedValue([
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalledWith('Visual diffs found.');
    expect(warningMock).toHaveBeenCalledWith('Visual diffs found.');
  });

  it('should call setFailed without setting commit status when visual tests fail for non-diff reason and visual-test-command-fails-on-diff is false', async () => {
    execMock.mockResolvedValue(1);
    getBooleanInputMock.mockImplementation(name =>
      name === 'visual-test-command-fails-on-diff' ? false : undefined
    );
    globMock.mockResolvedValue([]);
    await runAction();
    expect(setFailedMock).toHaveBeenCalledWith(
      'The job failed, and this is not due to visual tests.'
    );
    expect(createCommitStatusMock).not.toHaveBeenCalled();
  });

  it('should call setFailed without setting commit status when visual-test-command-fails-on-diff is false and 1 failure with multiple diffs', async () => {
    execMock.mockResolvedValue(1);
    getBooleanInputMock.mockImplementation(name =>
      name === 'visual-test-command-fails-on-diff' ? false : undefined
    );
    globMock.mockResolvedValue([
      'path/to/screenshots/diff1.png',
      'path/to/screenshots/new1.png',
      'path/to/screenshots/diff2.png',
      'path/to/screenshots/new2.png',
      'path/to/screenshots/diff3.png',
      'path/to/screenshots/new3.png'
    ]);
    await runAction();
    expect(setFailedMock).toHaveBeenCalledWith(
      'The job failed, and this is not due to visual tests.'
    );
    expect(createCommitStatusMock).not.toHaveBeenCalled();
  });

  it('should fail when workflow is pr and visual-test-command is not provided', async () => {
    getMultilineInputMock.mockImplementation(() => []);
    execMock.mockResolvedValue(0);
    await runAction();
    expect(setFailedMock).toHaveBeenCalledWith(
      'visual-test-command is required when workflow is pr.'
    );
  });

  describe('merge workflow', () => {
    const mergeInputMap: Record<string, string> = {
      ...inputMap,
      workflow: 'merge'
    };

    beforeEach(() => {
      getInputMock.mockImplementation(
        (name: string) => mergeInputMap[name] ?? ''
      );
    });

    it('should call updateBaseImages with correct args', async () => {
      await runAction();
      expect(updateBaseImagesMock).toHaveBeenCalledWith(
        'sha',
        'some-bucket',
        expect.any(Function)
      );
      expect(execMock).not.toHaveBeenCalled();
      expect(createCommitStatusMock).not.toHaveBeenCalled();
      expect(setFailedMock).not.toHaveBeenCalled();
    });
  });
});

describe('s3-operations', () => {
  let s3InputMap: Record<string, string> = {};

  const defaultS3InputMap: Record<string, string> = {
    'bucket-name': 'test-bucket',
    'screenshots-directory': 'path/to/screenshots',
    'package-paths': '',
    'resize-width': '',
    'resize-height': ''
  };

  async function getS3Operations() {
    return import('../src/s3-operations');
  }

  beforeEach(() => {
    s3InputMap = { ...defaultS3InputMap };
    getInputMock.mockImplementation((name: string) => s3InputMap[name] ?? '');

    listObjectsMock.mockResolvedValue({ Contents: [] });
    getObjectMock.mockResolvedValue({ Body: null });
    putObjectMock.mockResolvedValue({});
    copyObjectMock.mockResolvedValue({});
    globMock.mockResolvedValue([]);
    mkdirMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(Buffer.from('image-data'));
    createWriteStreamMock.mockReturnValue(new EventEmitter());

    jimpReadMock.mockResolvedValue(jimpImageMock);
    jimpImageMock.resize.mockReturnValue(jimpImageMock);
    jimpImageMock.getBuffer.mockResolvedValue(Buffer.from('resized-image'));
  });

  afterEach(() => {
    mock.clearAllMocks();
  });

  describe('downloadBaseImages', () => {
    it('should create screenshots directory and skip download when prefix does not exist', async () => {
      listObjectsMock.mockResolvedValue({ Contents: [] });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages();

      expect(mkdirMock).toHaveBeenCalledWith('path/to/screenshots', {
        recursive: true
      });
      expect(getObjectMock).not.toHaveBeenCalled();
    });

    it('should create screenshots directory and skip download when S3 check throws', async () => {
      listObjectsMock.mockRejectedValue(new Error('S3 error'));

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages();

      expect(mkdirMock).toHaveBeenCalledWith('path/to/screenshots', {
        recursive: true
      });
      expect(getObjectMock).not.toHaveBeenCalled();
    });

    it('should download only base.png files from S3 when prefix exists', async () => {
      // checkS3PrefixExists → prefix exists
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component/base.png' }]
      });
      // downloadS3Directory → list all objects (new.png should be filtered out)
      listObjectsMock.mockResolvedValueOnce({
        Contents: [
          { Key: 'base-images/component/base.png' },
          { Key: 'base-images/component/new.png' }
        ]
      });
      getObjectMock.mockResolvedValue({ Body: new MockReadable() });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages();

      expect(getObjectMock).toHaveBeenCalledTimes(1);
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'base-images/component/base.png'
      });
      expect(createWriteStreamMock).toHaveBeenCalledTimes(1);
    });

    it('should skip writing file when S3 body is not a Readable', async () => {
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component/base.png' }]
      });
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component/base.png' }]
      });
      getObjectMock.mockResolvedValue({ Body: 'not-a-readable' });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages();

      expect(createWriteStreamMock).not.toHaveBeenCalled();
    });

    it('should download all base images across multiple pages when results are truncated', async () => {
      // checkS3PrefixExists → prefix exists
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component/base.png' }]
      });
      // downloadS3Directory → first page (truncated)
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component1/base.png' }],
        IsTruncated: true,
        NextContinuationToken: 'token-1'
      });
      // downloadS3Directory → second page (last)
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component2/base.png' }],
        IsTruncated: false
      });
      getObjectMock.mockResolvedValue({ Body: new MockReadable() });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages();

      expect(listObjectsMock).toHaveBeenCalledWith(
        expect.objectContaining({ ContinuationToken: 'token-1' })
      );
      expect(getObjectMock).toHaveBeenCalledTimes(2);
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'base-images/component1/base.png'
      });
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'base-images/component2/base.png'
      });
    });

    it('should download from each package path subdirectory when package-paths is set', async () => {
      s3InputMap['package-paths'] = 'pkg1,pkg2';

      // checkS3PrefixExists
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/something' }]
      });
      // downloadS3Directory for pkg1
      listObjectsMock.mockResolvedValueOnce({ Contents: [] });
      // downloadS3Directory for pkg2
      listObjectsMock.mockResolvedValueOnce({ Contents: [] });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages();

      expect(listObjectsMock).toHaveBeenCalledTimes(3);
      expect(listObjectsMock).toHaveBeenCalledWith(
        expect.objectContaining({ Prefix: 'base-images/pkg1/' })
      );
      expect(listObjectsMock).toHaveBeenCalledWith(
        expect.objectContaining({ Prefix: 'base-images/pkg2/' })
      );
    });
  });

  describe('uploadAllImages', () => {
    it('should upload all files from directories that contain a new.png', async () => {
      globMock.mockResolvedValue([
        'component/base.png',
        'component/new.png',
        'component/diff.png'
      ]);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(putObjectMock).toHaveBeenCalledTimes(3);
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: path.join('new-images/abc123/', 'component/base.png')
        })
      );
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: path.join('new-images/abc123/', 'component/new.png')
        })
      );
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: path.join('new-images/abc123/', 'component/diff.png')
        })
      );
    });

    it('should exclude files from directories that have no new.png', async () => {
      globMock.mockResolvedValue([
        'failing/base.png',
        'failing/new.png',
        'passing/base.png' // no new.png in passing/ → excluded
      ]);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(putObjectMock).toHaveBeenCalledTimes(2);
      expect(putObjectMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          Key: expect.stringContaining('passing/base.png')
        })
      );
    });

    it('should not upload anything when no new.png files exist', async () => {
      globMock.mockResolvedValue(['component/base.png', 'component/diff.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(putObjectMock).not.toHaveBeenCalled();
    });

    it('should glob and upload from each package path subdirectory', async () => {
      s3InputMap['package-paths'] = 'pkg1,pkg2';
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(globMock).toHaveBeenCalledTimes(2);
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: expect.stringContaining('pkg1')
        })
      );
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: expect.stringContaining('pkg2')
        })
      );
    });

    it('should upload the original buffer when no resize inputs are set', async () => {
      const originalBuffer = Buffer.from('original-image');
      globMock.mockResolvedValue(['component/new.png']);
      readFileMock.mockResolvedValue(originalBuffer);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(jimpReadMock).not.toHaveBeenCalled();
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ Body: originalBuffer })
      );
    });

    it('should resize with width only when resize-width is set', async () => {
      s3InputMap['resize-width'] = '200';
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(jimpReadMock).toHaveBeenCalled();
      expect(jimpImageMock.resize).toHaveBeenCalledWith({ w: 200 });
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ Body: Buffer.from('resized-image') })
      );
    });

    it('should resize with height only when resize-height is set', async () => {
      s3InputMap['resize-height'] = '150';
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(jimpImageMock.resize).toHaveBeenCalledWith({ h: 150 });
    });

    it('should resize to fit within bounds when both resize-width and resize-height are set', async () => {
      s3InputMap['resize-width'] = '200';
      s3InputMap['resize-height'] = '150';
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      // mock image is 400x300; scale = min(200/400, 150/300, 1) = 0.5
      expect(jimpImageMock.resize).toHaveBeenCalledWith({ w: 200, h: 150 });
    });
  });

  describe('uploadOriginalNewImages', () => {
    it('should return early when no resize inputs are set', async () => {
      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123');

      expect(globMock).not.toHaveBeenCalled();
      expect(putObjectMock).not.toHaveBeenCalled();
    });

    it('should upload original new.png files (without resize) when resize-width is set', async () => {
      s3InputMap['resize-width'] = '200';
      const originalBuffer = Buffer.from('original-image');
      globMock.mockResolvedValue(['component/new.png']);
      readFileMock.mockResolvedValue(originalBuffer);

      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123');

      expect(jimpReadMock).not.toHaveBeenCalled();
      expect(putObjectMock).toHaveBeenCalledTimes(1);
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: path.join('original-new-images/abc123/', 'component/new.png'),
        Body: originalBuffer
      });
    });

    it('should upload original new.png files when resize-height is set', async () => {
      s3InputMap['resize-height'] = '150';
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123');

      expect(putObjectMock).toHaveBeenCalledTimes(1);
    });

    it('should upload from each package path subdirectory', async () => {
      s3InputMap['resize-width'] = '200';
      s3InputMap['package-paths'] = 'pkg1,pkg2';
      globMock.mockResolvedValue([]);

      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123');

      expect(globMock).toHaveBeenCalledTimes(2);
      expect(globMock).toHaveBeenCalledWith(
        '**/new.png',
        expect.objectContaining({
          cwd: path.join('path/to/screenshots', 'pkg1')
        })
      );
      expect(globMock).toHaveBeenCalledWith(
        '**/new.png',
        expect.objectContaining({
          cwd: path.join('path/to/screenshots', 'pkg2')
        })
      );
    });
  });

  describe('uploadBaseImages', () => {
    it('should upload each new image as a base image with the correct S3 key', async () => {
      const { uploadBaseImages } = await getS3Operations();
      await uploadBaseImages(['path/to/screenshots/component/new.png']);

      expect(putObjectMock).toHaveBeenCalledTimes(1);
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: path.join('base-images', 'component', 'base.png'),
        Body: expect.any(Buffer)
      });
    });

    it('should upload multiple base images', async () => {
      const { uploadBaseImages } = await getS3Operations();
      await uploadBaseImages([
        'path/to/screenshots/component1/new.png',
        'path/to/screenshots/component2/new.png'
      ]);

      expect(putObjectMock).toHaveBeenCalledTimes(2);
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: path.join('base-images', 'component1', 'base.png')
        })
      );
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: path.join('base-images', 'component2', 'base.png')
        })
      );
    });

    it('should resize the image when resize-width is set', async () => {
      s3InputMap['resize-width'] = '300';

      const { uploadBaseImages } = await getS3Operations();
      await uploadBaseImages(['path/to/screenshots/component/new.png']);

      expect(jimpReadMock).toHaveBeenCalled();
      expect(jimpImageMock.resize).toHaveBeenCalledWith({ w: 300 });
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ Body: Buffer.from('resized-image') })
      );
    });
  });
});
