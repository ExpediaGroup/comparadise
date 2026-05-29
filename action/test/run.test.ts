import {
  VISUAL_REGRESSION_CONTEXT,
  VISUAL_TESTS_FAILED_TO_EXECUTE
} from 'shared/constants';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import path from 'path';
import type { Dependencies } from '../src/dependencies';

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

const execMock = mock();
const globMock = mock();

const unlinkSyncMock = mock();
const createWriteStreamMock = mock();
const mkdirMock = mock();
const readFileMock = mock();

const jimpImageMock = {
  width: 400,
  height: 300,
  resize: mock(),
  getBuffer: mock()
};
const jimpReadMock = mock();

const createCommitStatusMock = mock();
const listPullRequestsAssociatedWithCommitMock = mock<
  () => Promise<{ data: { number: number; node_id?: string }[] }>
>(() => Promise.resolve({ data: [{ number: 123 }] }));
const listCommitStatusesForRefMock = mock(() => ({
  data: [
    {
      context: 'some context',
      state: 'success'
    }
  ]
}));
const getBranchMock = mock<
  () => Promise<{ data: { commit: { sha: string } } }>
>(() => Promise.resolve({ data: { commit: { sha: 'headsha' } } }));
const compareCommitsWithBaseheadMock = mock<
  () => Promise<{ data: { merge_base_commit: { sha: string } } }>
>(() =>
  Promise.resolve({ data: { merge_base_commit: { sha: 'ancestor-sha' } } })
);
const getCommitMock = mock<
  () => Promise<{ data: { parents: Array<{ sha: string }> } }>
>(() => Promise.resolve({ data: { parents: [{ sha: 'parent-sha' }] } }));
const listOpenPullsMock = mock<() => Promise<{ data: unknown[] }>>(() =>
  Promise.resolve({ data: [] })
);
const createCommentMock = mock();
const listCommentsMock = mock(() => ({ data: [{ id: 1 }] }));
const updateCommentMock = mock();
const graphqlMock = mock();

function makeDeps(): Dependencies {
  return {
    core: {
      setFailed: mock(),
      warning: mock(),
      info: mock()
    },
    octokit: {
      rest: {
        repos: {
          createCommitStatus: createCommitStatusMock,
          listPullRequestsAssociatedWithCommit:
            listPullRequestsAssociatedWithCommitMock,
          listCommitStatusesForRef: listCommitStatusesForRefMock,
          getBranch: getBranchMock,
          compareCommitsWithBasehead: compareCommitsWithBaseheadMock,
          getCommit: getCommitMock
        },
        issues: {
          createComment: createCommentMock,
          listComments: listCommentsMock,
          updateComment: updateCommentMock
        },
        pulls: {
          list: listOpenPullsMock
        }
      },
      graphql: graphqlMock
    } as unknown as Dependencies['octokit'],
    exec: execMock,
    glob: globMock as unknown as Dependencies['glob'],
    jimp: { read: jimpReadMock },
    s3: {
      listObjects: listObjectsMock,
      listAllObjects:
        listAllObjects as unknown as Dependencies['s3']['listAllObjects'],
      getObject: getObjectMock,
      putObject: putObjectMock,
      deleteObjects: deleteObjectsMock,
      getKeysFromS3: getKeysFromS3Mock,
      updateBaseImages: updateBaseImagesMock
    } as unknown as Dependencies['s3'],
    fs: {
      unlinkSync: unlinkSyncMock,
      createWriteStream: createWriteStreamMock,
      mkdir: mkdirMock,
      readFile: readFileMock
    },
    hashFile: mock(() => Promise.resolve('mockhash')),
    context: {
      runAttempt: 1,
      runId: 456,
      serverUrl: 'https://github.com',
      repo: { owner: 'owner', repo: 'repo' },
      issue: { number: 0 }
    }
  };
}

// A Readable subclass whose pipe() immediately triggers 'finish' on the destination
class MockReadable extends Readable {
  _read() {}
  pipe<T extends NodeJS.WritableStream>(dest: T): T {
    process.nextTick(() => (dest as unknown as EventEmitter).emit('finish'));
    return dest;
  }
}

const setEnv = (map: Record<string, string | undefined>) => {
  for (const [key, value] of Object.entries(map)) {
    const envKey = `INPUT_${key.replace(/ /g, '_').toUpperCase()}`;
    if (value === undefined) {
      delete process.env[envKey];
    } else {
      process.env[envKey] = value;
    }
  }
};

const clearEnv = (...keys: string[]) => {
  for (const key of keys) {
    delete process.env[`INPUT_${key.replace(/ /g, '_').toUpperCase()}`];
  }
};

const inputMap: Record<string, string> = {
  'screenshots-directory': 'path/to/screenshots',
  'bucket-name': 'some-bucket',
  'commit-hash': 'sha',
  'github-token': 'some-token',
  'comparadise-host': 'https://comparadise.app',
  'use-base-images': 'true',
  'update-base-images-on-accept': 'false'
};

const diffIdInputMap: Record<string, string | undefined> = {
  ...inputMap,
  'diff-id': 'uniqueId',
  'commit-hash': undefined
};

async function runAction(deps: Dependencies) {
  const { run } = await import('../src/run');
  await run(deps);
}

function mockScreenshotFiles(deps: Dependencies, files: string[]) {
  globMock.mockImplementation((pattern: string) =>
    Promise.resolve(pattern === '**/screenshots/**/new.png' ? [] : files)
  );
}

describe('main', () => {
  let deps: Dependencies;

  beforeEach(() => {
    deps = makeDeps();

    setEnv(inputMap);
    setEnv({ 'visual-test-command-fails-on-diff': 'true' });
    setEnv({ 'visual-test-command': 'run my visual tests' });

    listObjectsMock.mockResolvedValue({ Contents: [] });
    getObjectMock.mockResolvedValue({ Body: null });
    putObjectMock.mockResolvedValue({});
    copyObjectMock.mockResolvedValue({});
    deleteObjectsMock.mockResolvedValue({});
    getKeysFromS3Mock.mockResolvedValue([]);
    updateBaseImagesMock.mockResolvedValue(undefined);
    getBranchMock.mockResolvedValue({ data: { commit: { sha: 'headsha' } } });
    compareCommitsWithBaseheadMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha' } }
    });
    getCommitMock.mockResolvedValue({
      data: { parents: [{ sha: 'parent-sha' }] }
    });
    listOpenPullsMock.mockResolvedValue({ data: [] });
    updateCommentMock.mockResolvedValue({});
    mkdirMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(Buffer.from('image-data'));
    createWriteStreamMock.mockReturnValue(new EventEmitter());
    jimpReadMock.mockResolvedValue(jimpImageMock);
    jimpImageMock.resize.mockReturnValue(jimpImageMock);
    jimpImageMock.getBuffer.mockResolvedValue(Buffer.from('resized-image'));
    unlinkSyncMock.mockReturnValue(undefined);
    mockScreenshotFiles(deps, []);
  });

  afterEach(() => {
    mock.clearAllMocks();
    clearEnv(
      'screenshots-directory',
      'bucket-name',
      'commit-hash',
      'diff-id',
      'github-token',
      'comparadise-host',
      'visual-test-command-fails-on-diff',
      'visual-test-command',
      'workflow',
      'package-paths',
      'use-base-images',
      'update-base-images-on-accept',
      'resize-width',
      'resize-height',
      'head-sha',
      'base-ref',
      'pr-sha',
      'pr-number',
      'merge-commit-sha'
    );
  });

  // Helper to assert no calls to octokit.rest methods
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

  it('should fail when neither diff-id nor commit-hash is provided', async () => {
    setEnv({ 'diff-id': undefined, 'commit-hash': undefined });
    execMock.mockResolvedValue(0);
    await runAction(deps);
    expect(deps.core.setFailed).toHaveBeenCalledWith(
      'Please provide either a commit-hash or a diff-id.'
    );
  });

  it('should fail when screenshots are found outside the configured screenshots-directory', async () => {
    execMock.mockResolvedValue(0);
    globMock.mockResolvedValueOnce([
      '/repo/packages/react-adapters/screenshots/test/new.png'
    ]);
    await runAction(deps);
    expect(deps.core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining(
        'Screenshots were found outside the configured screenshots-directory'
      )
    );
  });

  it('should fail if visual tests fail', async () => {
    execMock.mockResolvedValue(1);
    await runAction(deps);
    expect(deps.core.setFailed).toHaveBeenCalled();
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
    setEnv(diffIdInputMap);
    execMock.mockResolvedValue(1);
    await runAction(deps);
    expect(deps.core.setFailed).toHaveBeenCalled();
    assertNoOctokitCalls();
  });

  it('should pick commit-hash when both commit-hash and diff-id are provided', async () => {
    setEnv({ 'diff-id': '12345', 'commit-hash': 'sha' });
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, ['path/to/screenshots/base.png']);
    await runAction(deps);
    expect(deps.core.setFailed).not.toHaveBeenCalled();
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
    setEnv(diffIdInputMap);
    execMock.mockResolvedValue(0);
    await runAction(deps);
    expect(deps.core.setFailed).not.toHaveBeenCalled();
  });

  it('should pass if visual tests pass and no diffs or new images', async () => {
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, ['path/to/screenshots/base.png']);
    await runAction(deps);
    expect(deps.core.setFailed).not.toHaveBeenCalled();
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
    setEnv(diffIdInputMap);
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, ['path/to/screenshots/base.png']);
    await runAction(deps);
    expect(deps.core.setFailed).not.toHaveBeenCalled();
    assertNoOctokitCalls();
  });

  it('should fail if visual tests pass and some diff images were created', async () => {
    execMock.mockResolvedValue(1);
    mockScreenshotFiles(deps, [
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png',
      'path/to/another-screenshot/diff.png'
    ]);
    await runAction(deps);
    expect(deps.core.setFailed).toHaveBeenCalled();
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
    setEnv(diffIdInputMap);
    execMock.mockResolvedValue(1);
    mockScreenshotFiles(deps, [
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png',
      'path/to/another-screenshot/diff.png'
    ]);
    await runAction(deps);
    expect(deps.core.setFailed).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalledWith(
      'path/to/screenshots/diff.png'
    );
    expect(unlinkSyncMock).toHaveBeenCalledWith(
      'path/to/another-screenshot/diff.png'
    );
    assertNoOctokitCalls();
  });

  it('should fail if some visual tests fail and some diff images were created', async () => {
    setEnv({ 'visual-test-command': 'run my visual tests\nok thank you' });
    execMock.mockResolvedValue(1);
    mockScreenshotFiles(deps, [
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction(deps);
    expect(deps.core.setFailed).toHaveBeenCalled();
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
    setEnv({
      ...diffIdInputMap,
      'visual-test-command': 'run my visual tests\nok thank you'
    });
    execMock.mockResolvedValue(1);
    mockScreenshotFiles(deps, [
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction(deps);
    expect(deps.core.setFailed).toHaveBeenCalled();
    assertNoOctokitCalls();
  });

  it('should pass if visual tests initially fail but pass on retry', async () => {
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, ['path/to/screenshots/diff.png']);
    await runAction(deps);
    expect(deps.core.setFailed).not.toHaveBeenCalled();
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
    setEnv(diffIdInputMap);
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, ['path/to/screenshots/diff.png']);
    await runAction(deps);
    expect(deps.core.setFailed).not.toHaveBeenCalled();
    expect(unlinkSyncMock).toHaveBeenCalledWith('path/to/screenshots/diff.png');
    assertNoOctokitCalls();
  });

  it('should set pending status and upload to new-images if visual tests pass and only new images were created', async () => {
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, [
      'path/to/screenshots/existingTest/base.png',
      'path/to/screenshots/newTest1/new.png',
      'path/to/screenshots/newTest2/new.png'
    ]);
    await runAction(deps);
    expect(deps.core.setFailed).not.toHaveBeenCalled();
    expect(deps.core.warning).toHaveBeenCalledWith(
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
    setEnv(diffIdInputMap);
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, [
      'path/to/screenshots/existingTest/base.png',
      'path/to/screenshots/newTest1/new.png',
      'path/to/screenshots/newTest2/new.png'
    ]);
    await runAction(deps);
    expect(deps.core.setFailed).not.toHaveBeenCalled();
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: expect.stringContaining('new-images/uniqueId/')
      })
    );
    assertNoOctokitCalls();
  });

  it('should use subdirectories if provided', async () => {
    execMock.mockResolvedValue(0);
    setEnv({ 'package-paths': 'path/1,path/2' });
    mockScreenshotFiles(deps, [
      'path/to/screenshots/path/1/component/base.png',
      'path/to/screenshots/path/1/component/diff.png',
      'path/to/screenshots/path/1/component/new.png',
      'path/to/screenshots/path/2/component/base.png'
    ]);
    await runAction(deps);
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
    setEnv({ ...diffIdInputMap, 'package-paths': 'path/1,path/2' });
    mockScreenshotFiles(deps, [
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction(deps);
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
    setEnv({ 'use-base-images': 'true' });
    mockScreenshotFiles(deps, [
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction(deps);
    expect(listObjectsMock).toHaveBeenCalledWith(
      expect.objectContaining({ Prefix: 'base-images/' })
    );
  });

  it('should not download base images if use-base-images specified as false and set URL param', async () => {
    execMock.mockResolvedValue(0);
    setEnv({ 'use-base-images': 'false' });
    mockScreenshotFiles(deps, [
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction(deps);
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
    setEnv({ 'use-base-images': 'true', 'package-paths': 'path/1,path/2' });
    mockScreenshotFiles(deps, [
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction(deps);
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
    mockScreenshotFiles(deps, ['path/to/screenshots/base.png']);
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
    await runAction(deps);
    expect(createCommitStatusMock).not.toHaveBeenCalled();
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('should not set successful commit status if the latest Visual Regression status has been set', async () => {
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, ['path/to/screenshots/base.png']);
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
    await runAction(deps);
    expect(createCommitStatusMock).not.toHaveBeenCalled();
  });

  it('should not set commit status or create comment if the latest Visual Regression status is failure because tests failed to execute successfully', async () => {
    execMock.mockResolvedValue(1);
    mockScreenshotFiles(deps, [
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
    await runAction(deps);
    expect(deps.core.setFailed).not.toHaveBeenCalled();
    expect(createCommitStatusMock).not.toHaveBeenCalled();
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('should set successful commit status (and disable auto merge) if a visual test failed to execute but this is a re-run', async () => {
    deps.context.runAttempt = 2;
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, ['path/to/screenshots/base.png']);
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
    graphqlMock.mockResolvedValue({});
    listPullRequestsAssociatedWithCommitMock.mockResolvedValueOnce({
      data: [{ number: 123, node_id: 'PR_123' }]
    });
    await runAction(deps);
    expect(graphqlMock).toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalled();
  });

  it('should set failure commit status (and not disable auto merge) if a visual test failed to execute but this is a re-run', async () => {
    deps.context.runAttempt = 2;
    execMock.mockResolvedValue(1);
    mockScreenshotFiles(deps, [
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
    await runAction(deps);
    expect(graphqlMock).not.toHaveBeenCalled();
    expect(createCommitStatusMock).toHaveBeenCalled();
  });

  it('should delete S3 images for hash when tests pass on retry', async () => {
    deps.context.runAttempt = 2;
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, ['path/to/screenshots/base.png']);
    getKeysFromS3Mock.mockResolvedValueOnce([
      'new-images/sha/component/new.png'
    ]);
    getKeysFromS3Mock.mockResolvedValueOnce([]);
    graphqlMock.mockResolvedValue({});
    listPullRequestsAssociatedWithCommitMock.mockResolvedValueOnce({
      data: [{ number: 123, node_id: 'PR_123' }]
    });
    await runAction(deps);
    expect(deleteObjectsMock).toHaveBeenCalledWith({
      Bucket: 'some-bucket',
      Delete: {
        Objects: [{ Key: 'new-images/sha/component/new.png' }],
        Quiet: true
      }
    });
  });

  it('should delete S3 images for hash when tests pass on retry with diff-id input', async () => {
    deps.context.runAttempt = 2;
    setEnv(diffIdInputMap);
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, ['path/to/screenshots/base.png']);
    getKeysFromS3Mock.mockResolvedValueOnce([
      'new-images/uniqueId/component/new.png'
    ]);
    getKeysFromS3Mock.mockResolvedValueOnce([]);
    await runAction(deps);
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
    mockScreenshotFiles(deps, ['path/to/screenshots/base.png']);
    await runAction(deps);
    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });

  it('should skip deletion when no images exist in S3 on retry', async () => {
    deps.context.runAttempt = 2;
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, ['path/to/screenshots/base.png']);
    getKeysFromS3Mock.mockResolvedValue([]);
    graphqlMock.mockResolvedValue({});
    listPullRequestsAssociatedWithCommitMock.mockResolvedValueOnce({
      data: [{ number: 123, node_id: 'PR_123' }]
    });
    await runAction(deps);
    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });

  it('should only delete S3 images scoped to package-paths on retry', async () => {
    deps.context.runAttempt = 2;
    setEnv({ 'package-paths': 'pkg1' });
    execMock.mockResolvedValue(0);
    mockScreenshotFiles(deps, ['path/to/screenshots/pkg1/base.png']);
    getKeysFromS3Mock.mockResolvedValueOnce([
      'new-images/sha/pkg1/component/new.png',
      'new-images/sha/pkg2/component/new.png'
    ]);
    getKeysFromS3Mock.mockResolvedValueOnce([
      'original-new-images/sha/pkg1/component/new.png',
      'original-new-images/sha/pkg2/component/new.png'
    ]);
    graphqlMock.mockResolvedValue({});
    listPullRequestsAssociatedWithCommitMock.mockResolvedValueOnce({
      data: [{ number: 123, node_id: 'PR_123' }]
    });
    await runAction(deps);
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
    setEnv({ 'visual-test-command-fails-on-diff': 'true' });
    mockScreenshotFiles(deps, [
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction(deps);
    expect(deps.core.setFailed).toHaveBeenCalledWith('Visual diffs found.');
    expect(deps.core.warning).not.toHaveBeenCalledWith('Visual diffs found.');
  });

  it('should call warning instead of setFailed when visual-test-command-fails-on-diff is false', async () => {
    execMock.mockResolvedValue(0);
    setEnv({ 'visual-test-command-fails-on-diff': 'false' });
    mockScreenshotFiles(deps, [
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await runAction(deps);
    expect(deps.core.setFailed).not.toHaveBeenCalledWith('Visual diffs found.');
    expect(deps.core.warning).toHaveBeenCalledWith('Visual diffs found.');
  });

  it('should call setFailed without setting commit status when visual tests fail for non-diff reason and visual-test-command-fails-on-diff is false', async () => {
    execMock.mockResolvedValue(1);
    setEnv({ 'visual-test-command-fails-on-diff': 'false' });
    globMock.mockResolvedValue([]);
    await runAction(deps);
    expect(deps.core.setFailed).toHaveBeenCalledWith(
      'The job failed, and this is not due to visual tests.'
    );
    expect(createCommitStatusMock).not.toHaveBeenCalled();
  });

  it('should call setFailed without setting commit status when visual-test-command-fails-on-diff is false and 1 failure with multiple diffs', async () => {
    execMock.mockResolvedValue(1);
    setEnv({ 'visual-test-command-fails-on-diff': 'false' });
    mockScreenshotFiles(deps, [
      'path/to/screenshots/diff1.png',
      'path/to/screenshots/new1.png',
      'path/to/screenshots/diff2.png',
      'path/to/screenshots/new2.png',
      'path/to/screenshots/diff3.png',
      'path/to/screenshots/new3.png'
    ]);
    await runAction(deps);
    expect(deps.core.setFailed).toHaveBeenCalledWith(
      'The job failed, and this is not due to visual tests.'
    );
    expect(createCommitStatusMock).not.toHaveBeenCalled();
  });

  it('should fail when workflow is pr and visual-test-command is not provided', async () => {
    setEnv({ 'visual-test-command': '' });
    execMock.mockResolvedValue(0);
    await runAction(deps);
    expect(deps.core.setFailed).toHaveBeenCalledWith(
      'visual-test-command is required when workflow is pr.'
    );
  });

  describe('merge workflow', () => {
    beforeEach(() => {
      setEnv({ workflow: 'merge' });
    });

    it('should call updateBaseImages with correct args', async () => {
      await runAction(deps);
      expect(updateBaseImagesMock).toHaveBeenCalledWith(
        'sha',
        'some-bucket',
        expect.any(Function)
      );
      expect(execMock).not.toHaveBeenCalled();
      expect(createCommitStatusMock).not.toHaveBeenCalled();
      expect(deps.core.setFailed).not.toHaveBeenCalled();
    });
  });

  describe('manifest workflows', () => {
    it('runs manifest-generate when workflow is manifest-generate', async () => {
      setEnv({ workflow: 'manifest-generate' });
      execMock.mockResolvedValue(0);
      globMock.mockResolvedValue([]);

      await runAction(deps);

      expect(execMock).toHaveBeenCalledWith('run my visual tests', [], {
        ignoreReturnCode: true
      });
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: 'some-bucket',
        Key: 'manifests/sha.json',
        Body: '{}',
        ContentType: 'application/json'
      });
      expect(updateBaseImagesMock).not.toHaveBeenCalled();
    });

    it('runs manifest-compare when workflow is manifest-compare', async () => {
      setEnv({ workflow: 'manifest-compare', 'base-ref': 'main' });
      getObjectMock.mockImplementation(({ Key }: { Key: string }) => {
        if (Key === 'manifests/sha.json') {
          return Promise.resolve({
            Body: {
              transformToString: () => Promise.resolve('{"Button":"hash1"}')
            }
          });
        }

        if (Key === 'manifests/headsha.json') {
          return Promise.resolve({
            Body: {
              transformToString: () => Promise.resolve('{"Button":"hash1"}')
            }
          });
        }

        throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
      });

      await runAction(deps);

      expect(getBranchMock).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        branch: 'main'
      });
      expect(createCommitStatusMock).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        sha: 'sha',
        state: 'success',
        description: 'Visual tests passed!',
        context: VISUAL_REGRESSION_CONTEXT
      });
      expect(execMock).not.toHaveBeenCalled();
    });

    it('runs manifest-merge when workflow is manifest-merge', async () => {
      setEnv({
        workflow: 'manifest-merge',
        'pr-sha': 'pr-sha',
        'pr-number': '17',
        'merge-commit-sha': 'merge-sha'
      });
      getCommitMock.mockResolvedValue({
        data: { parents: [{ sha: 'parent-sha' }] }
      });
      getObjectMock.mockImplementation(({ Key }: { Key: string }) => {
        if (Key === 'changesets/pr-sha.json') {
          throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
        }

        if (Key === 'manifests/parent-sha.json') {
          return Promise.resolve({
            Body: {
              transformToString: () => Promise.resolve('{"Button":"hash1"}')
            }
          });
        }

        throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
      });

      await runAction(deps);

      expect(getCommitMock).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'merge-sha'
      });
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: 'some-bucket',
        Key: 'manifests/merge-sha.json',
        Body: JSON.stringify({ Button: 'hash1' }),
        ContentType: 'application/json'
      });
      expect(execMock).not.toHaveBeenCalled();
      expect(updateBaseImagesMock).not.toHaveBeenCalled();
    });
  });
});

describe('s3-operations', () => {
  let deps: Dependencies;

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
    deps = makeDeps();
    setEnv(defaultS3InputMap);

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
    clearEnv(
      'bucket-name',
      'screenshots-directory',
      'package-paths',
      'resize-width',
      'resize-height'
    );
  });

  describe('downloadBaseImages', () => {
    it('should create screenshots directory and skip download when prefix does not exist', async () => {
      listObjectsMock.mockResolvedValue({ Contents: [] });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages(deps);

      expect(mkdirMock).toHaveBeenCalledWith('path/to/screenshots', {
        recursive: true
      });
      expect(getObjectMock).not.toHaveBeenCalled();
    });

    it('should create screenshots directory and skip download when S3 check throws', async () => {
      listObjectsMock.mockRejectedValue(new Error('S3 error'));

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages(deps);

      expect(mkdirMock).toHaveBeenCalledWith('path/to/screenshots', {
        recursive: true
      });
      expect(getObjectMock).not.toHaveBeenCalled();
    });

    it('should download only base.png files from S3 when prefix exists', async () => {
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component/base.png' }]
      });
      listObjectsMock.mockResolvedValueOnce({
        Contents: [
          { Key: 'base-images/component/base.png' },
          { Key: 'base-images/component/new.png' }
        ]
      });
      getObjectMock.mockResolvedValue({ Body: new MockReadable() });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages(deps);

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
      await downloadBaseImages(deps);

      expect(createWriteStreamMock).not.toHaveBeenCalled();
    });

    it('should download all base images across multiple pages when results are truncated', async () => {
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component/base.png' }]
      });
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component1/base.png' }],
        IsTruncated: true,
        NextContinuationToken: 'token-1'
      });
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component2/base.png' }],
        IsTruncated: false
      });
      getObjectMock.mockResolvedValue({ Body: new MockReadable() });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages(deps);

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
      setEnv({ 'package-paths': 'pkg1,pkg2' });

      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/something' }]
      });
      listObjectsMock.mockResolvedValueOnce({ Contents: [] });
      listObjectsMock.mockResolvedValueOnce({ Contents: [] });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages(deps);

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
      await uploadAllImages('abc123', deps);

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
        'passing/base.png'
      ]);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123', deps);

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
      await uploadAllImages('abc123', deps);

      expect(putObjectMock).not.toHaveBeenCalled();
    });

    it('should glob and upload from each package path subdirectory', async () => {
      setEnv({ 'package-paths': 'pkg1,pkg2' });
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123', deps);

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
      await uploadAllImages('abc123', deps);

      expect(jimpReadMock).not.toHaveBeenCalled();
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ Body: originalBuffer })
      );
    });

    it('should resize with width only when resize-width is set', async () => {
      setEnv({ 'resize-width': '200' });
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123', deps);

      expect(jimpReadMock).toHaveBeenCalled();
      expect(jimpImageMock.resize).toHaveBeenCalledWith({ w: 200 });
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ Body: Buffer.from('resized-image') })
      );
    });

    it('should resize with height only when resize-height is set', async () => {
      setEnv({ 'resize-height': '150' });
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123', deps);

      expect(jimpImageMock.resize).toHaveBeenCalledWith({ h: 150 });
    });

    it('should resize to fit within bounds when both resize-width and resize-height are set', async () => {
      setEnv({ 'resize-width': '200', 'resize-height': '150' });
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123', deps);

      expect(jimpImageMock.resize).toHaveBeenCalledWith({ w: 200, h: 150 });
    });
  });

  describe('uploadOriginalNewImages', () => {
    it('should return early when no resize inputs are set', async () => {
      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123', deps);

      expect(globMock).not.toHaveBeenCalled();
      expect(putObjectMock).not.toHaveBeenCalled();
    });

    it('should upload original new.png files (without resize) when resize-width is set', async () => {
      setEnv({ 'resize-width': '200' });
      const originalBuffer = Buffer.from('original-image');
      globMock.mockResolvedValue(['component/new.png']);
      readFileMock.mockResolvedValue(originalBuffer);

      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123', deps);

      expect(jimpReadMock).not.toHaveBeenCalled();
      expect(putObjectMock).toHaveBeenCalledTimes(1);
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: path.join('original-new-images/abc123/', 'component/new.png'),
        Body: originalBuffer
      });
    });

    it('should upload original new.png files when resize-height is set', async () => {
      setEnv({ 'resize-height': '150' });
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123', deps);

      expect(putObjectMock).toHaveBeenCalledTimes(1);
    });

    it('should upload from each package path subdirectory', async () => {
      setEnv({ 'resize-width': '200', 'package-paths': 'pkg1,pkg2' });
      globMock.mockResolvedValue([]);

      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123', deps);

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
      await uploadBaseImages(['path/to/screenshots/component/new.png'], deps);

      expect(putObjectMock).toHaveBeenCalledTimes(1);
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: path.join('base-images', 'component', 'base.png'),
        Body: expect.any(Buffer)
      });
    });

    it('should upload multiple base images', async () => {
      const { uploadBaseImages } = await getS3Operations();
      await uploadBaseImages(
        [
          'path/to/screenshots/component1/new.png',
          'path/to/screenshots/component2/new.png'
        ],
        deps
      );

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
      setEnv({ 'resize-width': '300' });

      const { uploadBaseImages } = await getS3Operations();
      await uploadBaseImages(['path/to/screenshots/component/new.png'], deps);

      expect(jimpReadMock).toHaveBeenCalled();
      expect(jimpImageMock.resize).toHaveBeenCalledWith({ w: 300 });
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ Body: Buffer.from('resized-image') })
      );
    });
  });
});
