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
    generateDiffsMock
      .mockReset()
      .mockResolvedValue({ diffed: [], identical: [] });
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
      prOwns: [{ path: 'Button', type: 'changed', baseHash: 'h-base' }],
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
      prOwns: [{ path: 'Button', type: 'changed', baseHash: 'h-base' }],
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
        prOwns: [{ path: 'Button', type: 'changed', baseHash: 'h-base' }]
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

  describe('outcome: classified — base image identical despite hash mismatch', () => {
    const result: CompareResult = {
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha: 'pr-sha-111',
      prOwns: [{ path: 'Button', type: 'changed', baseHash: 'h-base' }],
      mainOwns: [],
      conflicts: []
    };

    beforeEach(() => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue({ Button: 'pr-hash-button' });
      generateDiffsMock.mockResolvedValue({
        diffed: [],
        identical: ['Button']
      });
    });

    it('sets a success commit status', async () => {
      await manifestCompare(params, makeDeps());

      expect(setCommitStatusMock).toHaveBeenCalledTimes(1);
      expect(setCommitStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sha: 'pr-sha-111',
          state: 'success',
          description: 'Visual tests passed!'
        })
      );
    });

    it('does not write a changeset — a merge would otherwise copy the identical image over base-images/', async () => {
      await manifestCompare(params, makeDeps());

      expect(putChangesetMock).not.toHaveBeenCalled();
    });

    it('does not post a comment', async () => {
      await manifestCompare(params, makeDeps());

      expect(postCommentMock).not.toHaveBeenCalled();
    });

    it('logs the identical paths without raising a warning annotation', async () => {
      await manifestCompare(params, makeDeps());

      expect(warningMock).not.toHaveBeenCalled();
      expect(
        infoMock.mock.calls.some(call => String(call[0]).includes('Button'))
      ).toBe(true);
    });

    it('diffs before writing the changeset so identical paths can be excluded', async () => {
      generateDiffsMock.mockImplementation(() => {
        expect(putChangesetMock).not.toHaveBeenCalled();
        return Promise.resolve({ diffed: ['Button'], identical: [] });
      });

      await manifestCompare(params, makeDeps());

      expect(generateDiffsMock).toHaveBeenCalledTimes(1);
      expect(putChangesetMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('outcome: classified — mix of identical and genuinely changed', () => {
    const result: CompareResult = {
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha: 'pr-sha-111',
      prOwns: [
        { path: 'Button', type: 'changed', baseHash: 'h-base' },
        { path: 'Modal', type: 'changed', baseHash: 'h-modal' }
      ],
      mainOwns: [],
      conflicts: []
    };

    beforeEach(() => {
      classifyMock.mockResolvedValue(result);
      getManifestMock.mockResolvedValue({
        Button: 'pr-hash-button',
        Modal: 'pr-hash-modal'
      });
      generateDiffsMock.mockResolvedValue({
        diffed: ['Modal'],
        identical: ['Button']
      });
    });

    it('omits the identical path from the changeset', async () => {
      await manifestCompare(params, makeDeps());

      expect(putChangesetMock).toHaveBeenCalledWith(
        'test-bucket',
        'pr-sha-111',
        {
          _headSha: 'head-sha-222',
          Modal: 'pr-hash-modal'
        }
      );
    });

    it('omits the identical path from the comment and sets pending', async () => {
      await manifestCompare(params, makeDeps());

      const arg = postCommentMock.mock.calls[0]?.[0] as any;
      expect(arg.prOwns).toEqual([
        { path: 'Modal', type: 'changed', baseHash: 'h-modal' }
      ]);
      expect(setCommitStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'pending' })
      );
    });
  });

  describe('PR manifest source (squash result threading)', () => {
    const result: CompareResult = {
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha: 'pr-sha-111',
      prOwns: [{ path: 'Button', type: 'changed', baseHash: 'h-base' }],
      mainOwns: [],
      conflicts: []
    };

    it('reuses the squashed manifest and does not re-fetch it (monorepo)', async () => {
      classifyMock.mockResolvedValue(result);
      // Monorepo: squash returns the merged manifest it just uploaded.
      squashPrManifestMock.mockResolvedValue({ Button: 'squashed-hash' });

      await manifestCompare(params, makeDeps());

      // The squashed result is threaded through — no redundant getPrManifest.
      expect(getManifestMock).not.toHaveBeenCalled();
      expect(putChangesetMock).toHaveBeenCalledWith(
        'test-bucket',
        'pr-sha-111',
        { _headSha: 'head-sha-222', Button: 'squashed-hash' }
      );
    });

    it('falls back to getPrManifest when there was nothing to squash (single package)', async () => {
      classifyMock.mockResolvedValue(result);
      // Single-package: squash finds no per-chunk parts and returns null.
      squashPrManifestMock.mockResolvedValue(null);
      getManifestMock.mockResolvedValue({ Button: 'fetched-hash' });

      await manifestCompare(params, makeDeps());

      expect(getManifestMock).toHaveBeenCalledWith('test-bucket', 'pr-sha-111');
      expect(putChangesetMock).toHaveBeenCalledWith(
        'test-bucket',
        'pr-sha-111',
        { _headSha: 'head-sha-222', Button: 'fetched-hash' }
      );
    });
  });

  describe('outcome: classified — prOwns deleted only', () => {
    const result: CompareResult = {
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha: 'pr-sha-111',
      prOwns: [{ path: 'Removed', type: 'deleted', baseHash: 'h-removed' }],
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
      prOwns: [{ path: 'NewThing', type: 'added', baseHash: null }],
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
        { path: 'Button', type: 'changed', baseHash: 'h-base' },
        { path: 'Removed', type: 'deleted', baseHash: 'h-removed' }
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
          prOwns: [{ path: 'Button', type: 'changed', baseHash: 'h-base' }]
        })
      );
      const commentArg = postCommentMock.mock.calls[0]?.[0] as any;
      expect(commentArg.prOwns).toEqual([
        { path: 'Button', type: 'changed', baseHash: 'h-base' }
      ]);
    });
  });
});
