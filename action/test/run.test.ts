import {
  VISUAL_REGRESSION_CONTEXT,
  VISUAL_TESTS_FAILED_TO_EXECUTE
} from 'shared';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

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
mock.module('fs', () => {
  // Import the actual fs module to pass through other methods
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const actualFs = require('fs');
  return {
    ...actualFs,
    unlinkSync: unlinkSyncMock
  };
});

const rmMock = mock();
mock.module('fs/promises', () => ({
  rm: rmMock
}));

const downloadBaseImagesMock = mock();
const uploadAllImagesMock = mock();
const uploadBaseImagesMock = mock();

let s3OperationCalls: Array<{
  operation: string;
  args: unknown[];
}> = [];

mock.module('../src/s3-operations', () => ({
  downloadBaseImages: (...args: unknown[]) => {
    s3OperationCalls.push({ operation: 'downloadBaseImages', args });
    return downloadBaseImagesMock(...args);
  },
  uploadAllImages: (...args: unknown[]) => {
    s3OperationCalls.push({ operation: 'uploadAllImages', args });
    return uploadAllImagesMock(...args);
  },
  uploadBaseImages: (...args: unknown[]) => {
    s3OperationCalls.push({ operation: 'uploadBaseImages', args });
    return uploadBaseImagesMock(...args);
  },
  uploadOriginalNewImages: (...args: unknown[]) => {
    s3OperationCalls.push({ operation: 'uploadOriginalNewImages', args });
  }
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
      name === 'fail-on-visual-diff' ? true : undefined
    );

    const multiLineInputMap: Record<string, string[]> = {
      'visual-test-command': ['run my visual tests']
    };
    getMultilineInputMock.mockImplementation(name => multiLineInputMap[name]);

    downloadBaseImagesMock.mockResolvedValue(undefined);
    uploadAllImagesMock.mockResolvedValue(undefined);
    uploadBaseImagesMock.mockResolvedValue(undefined);

    // Mock fs operations
    unlinkSyncMock.mockReturnValue(undefined);
    rmMock.mockResolvedValue(undefined);

    globMock.mockResolvedValue([]);

    s3OperationCalls = [];
  });

  afterEach(() => {
    mock.clearAllMocks();
    s3OperationCalls = [];
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
      description: 'A visual regression was detected. Check Comparadise!',
      target_url:
        'https://comparadise.app/?commitHash=sha&owner=owner&repo=repo&bucket=some-bucket&useBaseImages=true'
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

  it('should pass and upload base images if visual tests pass and only new images were created', async () => {
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue([
      'path/to/screenshots/existingTest/base.png',
      'path/to/screenshots/newTest1/new.png',
      'path/to/screenshots/newTest2/new.png'
    ]);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
    expect(uploadBaseImagesMock).toHaveBeenCalledWith([
      'path/to/screenshots/newTest1/new.png',
      'path/to/screenshots/newTest2/new.png'
    ]);
    expect(createCommitStatusMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'success',
      description: 'New base images were created!'
    });
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('should pass and upload base images if visual tests pass and only new images were created  with diff-id input', async () => {
    getInputMock.mockImplementation(name => diffIdInputMap[name]);
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValue([
      'path/to/screenshots/existingTest/base.png',
      'path/to/screenshots/newTest1/new.png',
      'path/to/screenshots/newTest2/new.png'
    ]);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalled();
    expect(uploadBaseImagesMock).toHaveBeenCalledWith([
      'path/to/screenshots/newTest1/new.png',
      'path/to/screenshots/newTest2/new.png'
    ]);
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
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(downloadBaseImagesMock).toHaveBeenCalled();
    expect(uploadAllImagesMock).toHaveBeenCalledWith('sha');
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
    expect(downloadBaseImagesMock).toHaveBeenCalled();
    expect(uploadAllImagesMock).toHaveBeenCalledWith('uniqueId');
    assertNoOctokitCalls();
  });

  it('should download base images if use-base-images specified as true', async () => {
    const downloadBaseImages = true;
    execMock.mockResolvedValue(0);
    getInputMock.mockImplementation(name => inputMap[name]);
    getBooleanInputMock.mockImplementation(() => downloadBaseImages);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(downloadBaseImagesMock).toHaveBeenCalled();
  });

  it('should not download base images if use-base-images specified as false and set URL param', async () => {
    const downloadBaseImages = false;
    execMock.mockResolvedValue(0);
    getInputMock.mockImplementation(name => inputMap[name]);
    getBooleanInputMock.mockImplementation(() => downloadBaseImages);
    globMock.mockResolvedValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(downloadBaseImagesMock).not.toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'pending',
      description: 'A visual regression was detected. Check Comparadise!',
      target_url:
        'https://comparadise.app/?commitHash=sha&owner=owner&repo=repo&bucket=some-bucket&useBaseImages=false'
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
    expect(downloadBaseImagesMock).toHaveBeenCalled();
    expect(uploadAllImagesMock).toHaveBeenCalledWith('sha');
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

  it('should call setFailed with the diff message when fail-on-visual-diff is true', async () => {
    execMock.mockResolvedValue(0);
    getBooleanInputMock.mockImplementation(name =>
      name === 'fail-on-visual-diff' ? true : undefined
    );
    globMock.mockResolvedValue([
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(setFailedMock).toHaveBeenCalledWith(
      'A visual regression was detected. Check Comparadise!'
    );
    expect(warningMock).not.toHaveBeenCalledWith(
      'A visual regression was detected. Check Comparadise!'
    );
  });

  it('should call warning instead of setFailed when fail-on-visual-diff is false', async () => {
    execMock.mockResolvedValue(0);
    getBooleanInputMock.mockImplementation(name =>
      name === 'fail-on-visual-diff' ? false : undefined
    );
    globMock.mockResolvedValue([
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction();
    expect(setFailedMock).not.toHaveBeenCalledWith(
      'A visual regression was detected. Check Comparadise!'
    );
    expect(warningMock).toHaveBeenCalledWith(
      'A visual regression was detected. Check Comparadise!'
    );
  });
});
