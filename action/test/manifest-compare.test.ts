/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  manifestCompare,
  type ManifestCompareDeps
} from '../src/manifest-compare';
import type { CompareResult } from '../src/manifest-compare-classify';

const squashPrManifestMock = mock<any>();
const classifyMock = mock<any>();
const generateDiffsMock = mock<any>();
const putChangesetMock = mock<any>();
const getManifestMock = mock<any>();
const setCommitStatusMock = mock<any>();
const postCommentMock = mock<any>();
const buildUrlMock = mock<any>();
const infoMock = mock<any>();
const setFailedMock = mock<any>();
const warningMock = mock<any>();

function makeDeps(
  overrides: Partial<ManifestCompareDeps> = {}
): ManifestCompareDeps {
  return {
    squashPrManifest: squashPrManifestMock,
    classify: classifyMock,
    generateDiffs: generateDiffsMock,
    putChangeset: putChangesetMock,
    getPrManifest: getManifestMock,
    setCommitStatus: setCommitStatusMock,
    postComment: postCommentMock,
    buildComparadiseUrl: buildUrlMock,
    core: {
      info: infoMock,
      setFailed: setFailedMock,
      warning: warningMock
    } as any,
    ...overrides
  };
}

const params = {
  bucket: 'test-bucket',
  prSha: 'pr-sha-111',
  repo: { owner: 'test-org', repo: 'test-repo' },
  baseRef: 'main'
};

describe('manifestCompare', () => {
  beforeEach(() => {
    squashPrManifestMock.mockReset().mockResolvedValue(undefined);
    classifyMock.mockReset();
    generateDiffsMock.mockReset().mockResolvedValue(undefined);
    putChangesetMock.mockReset().mockResolvedValue(undefined);
    getManifestMock.mockReset();
    setCommitStatusMock.mockReset().mockResolvedValue(undefined);
    postCommentMock.mockReset().mockResolvedValue(undefined);
    buildUrlMock.mockReset().mockReturnValue('https://comparadise.example/run');
    infoMock.mockReset();
    setFailedMock.mockReset();
    warningMock.mockReset();
  });

  describe('squash step', () => {
    it('squashes per-package PR manifests before classifying', async () => {
      classifyMock.mockResolvedValue({ outcome: 'match' } as CompareResult);
      squashPrManifestMock.mockImplementation(() => {
        expect(classifyMock).not.toHaveBeenCalled();
        return Promise.resolve();
      });

      await manifestCompare(params, makeDeps());

      expect(squashPrManifestMock).toHaveBeenCalledWith(
        'test-bucket',
        'pr-sha-111'
      );
      expect(classifyMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('outcome: match', () => {
    it('sets a success commit status', async () => {
      classifyMock.mockResolvedValue({ outcome: 'match' } as CompareResult);

      await manifestCompare(params, makeDeps());

      expect(setCommitStatusMock).toHaveBeenCalledTimes(1);
      expect(setCommitStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sha: 'pr-sha-111',
          state: 'success'
        })
      );
    });

    it('does not generate diffs, post comment, or write changeset', async () => {
      classifyMock.mockResolvedValue({ outcome: 'match' } as CompareResult);

      await manifestCompare(params, makeDeps());

      expect(generateDiffsMock).not.toHaveBeenCalled();
      expect(postCommentMock).not.toHaveBeenCalled();
      expect(putChangesetMock).not.toHaveBeenCalled();
    });
  });

  describe('outcome: classified — only mainOwns', () => {
    const result: CompareResult = {
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha: 'pr-sha-111',
      prOwns: [],
      mainOwns: ['Button'],
      conflicts: []
    };

    it('sets a success commit status (main changed, PR clean)', async () => {
      classifyMock.mockResolvedValue(result);

      await manifestCompare(params, makeDeps());

      expect(setCommitStatusMock).toHaveBeenCalledTimes(1);
      expect(setCommitStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({ sha: 'pr-sha-111', state: 'success' })
      );
    });

    it('does not generate diffs, post comment, or write changeset', async () => {
      classifyMock.mockResolvedValue(result);

      await manifestCompare(params, makeDeps());

      expect(generateDiffsMock).not.toHaveBeenCalled();
      expect(postCommentMock).not.toHaveBeenCalled();
      expect(putChangesetMock).not.toHaveBeenCalled();
    });
  });

  describe('outcome: classified — conflicts present', () => {
    const result: CompareResult = {
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha: 'pr-sha-111',
      prOwns: [{ path: 'Button', type: 'changed' }],
      mainOwns: [],
      conflicts: ['Card', 'Modal']
    };

    it('sets a failure commit status', async () => {
      classifyMock.mockResolvedValue(result);

      await manifestCompare(params, makeDeps());

      expect(setCommitStatusMock).toHaveBeenCalledTimes(1);
      expect(setCommitStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({ sha: 'pr-sha-111', state: 'failure' })
      );
    });

    it('posts a comment listing conflicting paths with rebase instruction', async () => {
      classifyMock.mockResolvedValue(result);

      await manifestCompare(params, makeDeps());

      expect(postCommentMock).toHaveBeenCalledTimes(1);
      const arg = postCommentMock.mock.calls[0]?.[0] as any;
      expect(arg.kind).toBe('conflict');
      expect(arg.conflicts).toEqual(['Card', 'Modal']);
      expect(arg.commitHash).toBe('pr-sha-111');
    });

    it('does not generate diffs or write changeset', async () => {
      classifyMock.mockResolvedValue(result);

      await manifestCompare(params, makeDeps());

      expect(generateDiffsMock).not.toHaveBeenCalled();
      expect(putChangesetMock).not.toHaveBeenCalled();
    });
  });

  describe('outcome: classified — prOwns changed', () => {
    const result: CompareResult = {
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha: 'pr-sha-111',
      prOwns: [{ path: 'Button', type: 'changed' }],
      mainOwns: [],
      conflicts: []
    };
    const prManifest = { Button: 'pr-hash-button' };

    it('generates diffs for prOwns entries', async () => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue(prManifest);

      await manifestCompare(params, makeDeps());

      expect(generateDiffsMock).toHaveBeenCalledTimes(1);
      expect(generateDiffsMock).toHaveBeenCalledWith({
        bucket: 'test-bucket',
        prSha: 'pr-sha-111',
        prOwns: [{ path: 'Button', type: 'changed' }]
      });
    });

    it('sets a pending commit status with the Comparadise URL', async () => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue(prManifest);

      await manifestCompare(params, makeDeps());

      expect(setCommitStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sha: 'pr-sha-111',
          state: 'pending',
          target_url: 'https://comparadise.example/run'
        })
      );
    });

    it('posts a diffs comment', async () => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue(prManifest);

      await manifestCompare(params, makeDeps());

      expect(postCommentMock).toHaveBeenCalledTimes(1);
      const arg = postCommentMock.mock.calls[0]?.[0] as any;
      expect(arg.kind).toBe('diffs');
      expect(arg.commitHash).toBe('pr-sha-111');
    });

    it('writes a changeset with _headSha and pr hash', async () => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue(prManifest);

      await manifestCompare(params, makeDeps());

      expect(putChangesetMock).toHaveBeenCalledTimes(1);
      expect(putChangesetMock).toHaveBeenCalledWith(
        'test-bucket',
        'pr-sha-111',
        {
          _headSha: 'head-sha-222',
          Button: 'pr-hash-button'
        }
      );
    });
  });

  describe('outcome: classified — prOwns deleted only', () => {
    const result: CompareResult = {
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha: 'pr-sha-111',
      prOwns: [{ path: 'Removed', type: 'deleted' }],
      mainOwns: [],
      conflicts: []
    };

    it('writes a changeset with null for the deleted path', async () => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue({});

      await manifestCompare(params, makeDeps());

      expect(putChangesetMock).toHaveBeenCalledWith(
        'test-bucket',
        'pr-sha-111',
        {
          _headSha: 'head-sha-222',
          Removed: null
        }
      );
    });

    it('sets a success commit status (no reviewable changes)', async () => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue({});

      await manifestCompare(params, makeDeps());

      expect(setCommitStatusMock).toHaveBeenCalledTimes(1);
      expect(setCommitStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({ sha: 'pr-sha-111', state: 'success' })
      );
    });

    it('does not generate diffs or post a comment', async () => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue({});

      await manifestCompare(params, makeDeps());

      expect(generateDiffsMock).not.toHaveBeenCalled();
      expect(postCommentMock).not.toHaveBeenCalled();
    });
  });

  describe('outcome: classified — prOwns added', () => {
    const result: CompareResult = {
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha: 'pr-sha-111',
      prOwns: [{ path: 'NewThing', type: 'added' }],
      mainOwns: [],
      conflicts: []
    };

    it('writes a changeset with the pr hash for the added path', async () => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue({ NewThing: 'pr-hash-new' });

      await manifestCompare(params, makeDeps());

      expect(putChangesetMock).toHaveBeenCalledWith(
        'test-bucket',
        'pr-sha-111',
        {
          _headSha: 'head-sha-222',
          NewThing: 'pr-hash-new'
        }
      );
    });
  });

  describe('outcome: classified — mixed prOwns and mainOwns', () => {
    const result: CompareResult = {
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha: 'pr-sha-111',
      prOwns: [
        { path: 'Button', type: 'changed' },
        { path: 'Removed', type: 'deleted' }
      ],
      mainOwns: ['Modal', 'Card'],
      conflicts: []
    };

    it('omits mainOwns entries from the changeset', async () => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue({ Button: 'pr-hash-button' });

      await manifestCompare(params, makeDeps());

      expect(putChangesetMock).toHaveBeenCalledWith(
        'test-bucket',
        'pr-sha-111',
        {
          _headSha: 'head-sha-222',
          Button: 'pr-hash-button',
          Removed: null
        }
      );
    });

    it('sets pending status and writes changeset', async () => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue({ Button: 'pr-hash-button' });

      await manifestCompare(params, makeDeps());

      expect(setCommitStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'pending' })
      );
      expect(putChangesetMock).toHaveBeenCalledTimes(1);
    });

    it('passes only reviewable (non-deleted) entries to generateDiffs and postComment', async () => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue({ Button: 'pr-hash-button' });

      await manifestCompare(params, makeDeps());

      expect(generateDiffsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prOwns: [{ path: 'Button', type: 'changed' }]
        })
      );
      const commentArg = postCommentMock.mock.calls[0]?.[0] as any;
      expect(commentArg.prOwns).toEqual([{ path: 'Button', type: 'changed' }]);
    });
  });
});
