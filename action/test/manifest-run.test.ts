/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { context as githubContext } from '@actions/github';
import { runManifestMergeWorkflow } from '../src/manifest-run';
import type { Dependencies } from '../src/dependencies';

const getObjectMock = mock<any>();
const putObjectMock = mock<any>();
const getCommitMock = mock<any>();
const listPullRequestsAssociatedWithCommitMock = mock<any>();
const pullsGetMock = mock<any>();
const setFailedMock = mock<any>();
const infoMock = mock<any>();

function makeDeps(): Dependencies {
  return {
    core: {
      setFailed: setFailedMock,
      warning: mock(),
      info: infoMock
    },
    octokit: {
      rest: {
        repos: {
          getCommit: getCommitMock,
          listPullRequestsAssociatedWithCommit:
            listPullRequestsAssociatedWithCommitMock
        },
        pulls: { get: pullsGetMock }
      }
    } as unknown as Dependencies['octokit'],
    exec: mock() as unknown as Dependencies['exec'],
    glob: mock() as unknown as Dependencies['glob'],
    jimp: { read: mock() },
    s3: {
      getObject: getObjectMock,
      putObject: putObjectMock
    } as unknown as Dependencies['s3'],
    fs: {
      unlinkSync: mock(),
      createWriteStream: mock(),
      mkdir: mock(),
      readFile: mock()
    },
    hashFile: mock() as unknown as Dependencies['hashFile'],
    context: {
      runAttempt: 1,
      runId: 1,
      serverUrl: 'https://github.com',
      repo: { owner: 'test-org', repo: 'test-repo' },
      issue: { number: 1 }
    }
  };
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

function noSuchKeyError(): Error {
  const error = new Error('NoSuchKey');
  error.name = 'NoSuchKey';
  return error;
}

describe('runManifestMergeWorkflow', () => {
  beforeEach(() => {
    getObjectMock.mockReset();
    putObjectMock.mockReset().mockResolvedValue({});
    getCommitMock.mockReset();
    listPullRequestsAssociatedWithCommitMock.mockReset();
    pullsGetMock.mockReset();
    setFailedMock.mockReset();
    infoMock.mockReset();
    githubContext.payload = {};
    setEnv({ 'bucket-name': 'test-bucket' });
  });

  it('merges a single-commit push event', async () => {
    githubContext.payload = { commits: [{ id: 'merge-sha-1' }] };
    listPullRequestsAssociatedWithCommitMock.mockResolvedValue({
      data: [{ number: 42 }]
    });
    pullsGetMock.mockResolvedValue({ data: { head: { sha: 'pr-head-sha' } } });
    getCommitMock.mockResolvedValue({
      data: { parents: [{ sha: 'parent-sha' }] }
    });
    // No changeset or parent manifest recorded — takes the "copy parent forward" path.
    getObjectMock.mockRejectedValue(noSuchKeyError());

    await runManifestMergeWorkflow(makeDeps());

    expect(setFailedMock).not.toHaveBeenCalled();
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'manifests/merge-sha-1.json' })
    );
  });

  it('fails when not triggered by a push event with commits', async () => {
    githubContext.payload = {};

    await runManifestMergeWorkflow(makeDeps());

    expect(setFailedMock).toHaveBeenCalledWith(
      expect.stringContaining('push event')
    );
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('processes a batched push event`s commits in order, one at a time', async () => {
    githubContext.payload = {
      commits: [{ id: 'commit-a' }, { id: 'commit-b' }]
    };

    listPullRequestsAssociatedWithCommitMock.mockImplementation(
      async ({ commit_sha }: { commit_sha: string }) => ({
        data: [{ number: commit_sha === 'commit-a' ? 10 : 20 }]
      })
    );
    pullsGetMock.mockImplementation(
      async ({ pull_number }: { pull_number: number }) => ({
        data: { head: { sha: `pr-head-${pull_number}` } }
      })
    );
    getCommitMock.mockImplementation(async ({ ref }: { ref: string }) => ({
      data: { parents: [{ sha: `parent-of-${ref}` }] }
    }));

    const callOrder: string[] = [];
    getObjectMock.mockImplementation(async ({ Key }: { Key: string }) => {
      callOrder.push(`getObject:${Key}`);
      throw noSuchKeyError();
    });
    putObjectMock.mockImplementation(async ({ Key }: { Key: string }) => {
      callOrder.push(`putObject:${Key}`);
      return {};
    });

    await runManifestMergeWorkflow(makeDeps());

    expect(setFailedMock).not.toHaveBeenCalled();
    expect(pullsGetMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ pull_number: 10 })
    );
    expect(pullsGetMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pull_number: 20 })
    );
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'manifests/commit-a.json' })
    );
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'manifests/commit-b.json' })
    );
    // commit-a's merge (changeset lookup, parent-manifest lookup, then the write) fully
    // completes before commit-b's starts.
    expect(callOrder).toEqual([
      'getObject:changesets/pr-head-10.json',
      'getObject:manifests/parent-of-commit-a.json',
      'putObject:manifests/commit-a.json',
      'getObject:changesets/pr-head-20.json',
      'getObject:manifests/parent-of-commit-b.json',
      'putObject:manifests/commit-b.json'
    ]);
  });

  it('skips a push commit with no associated pull request and continues with the rest', async () => {
    githubContext.payload = {
      commits: [{ id: 'commit-a' }, { id: 'commit-b' }]
    };

    listPullRequestsAssociatedWithCommitMock.mockImplementation(
      async ({ commit_sha }: { commit_sha: string }) => ({
        data: commit_sha === 'commit-a' ? [] : [{ number: 20 }]
      })
    );
    pullsGetMock.mockResolvedValue({ data: { head: { sha: 'pr-head-20' } } });
    getCommitMock.mockResolvedValue({
      data: { parents: [{ sha: 'parent-sha' }] }
    });
    getObjectMock.mockRejectedValue(noSuchKeyError());

    await runManifestMergeWorkflow(makeDeps());

    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining('No pull request associated with commit commit-a')
    );
    expect(pullsGetMock).toHaveBeenCalledTimes(1);
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'manifests/commit-b.json' })
    );
    expect(putObjectMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'manifests/commit-a.json' })
    );
  });
});
