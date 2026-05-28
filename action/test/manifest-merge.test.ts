/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { manifestMerge, type ManifestMergeDeps } from '../src/manifest-merge';
import type { Changeset, Manifest } from '../src/manifest-s3';

const getManifestMock = mock<any>();
const putManifestMock = mock<any>();
const getChangesetMock = mock<any>();
const getMergeParentShaMock = mock<any>();
const flagOverlappingOpenPrsMock = mock<any>();
const applyChangesetToBaseImagesMock = mock<any>();
const overlayChangesetMock = mock<any>();
const detectStaleConflictsMock = mock<any>();
const infoMock = mock<any>();
const setFailedMock = mock<any>();
const warningMock = mock<any>();

function makeDeps(
  overrides: Partial<ManifestMergeDeps> = {}
): ManifestMergeDeps {
  return {
    getManifest: getManifestMock,
    putManifest: putManifestMock,
    getChangeset: getChangesetMock,
    getMergeParentSha: getMergeParentShaMock,
    flagOverlappingOpenPrs: flagOverlappingOpenPrsMock,
    applyChangesetToBaseImages: applyChangesetToBaseImagesMock,
    overlayChangeset: overlayChangesetMock,
    detectStaleConflicts: detectStaleConflictsMock,
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
  prNumber: 100,
  prSha: 'pr-sha-111',
  mergeCommitSha: 'merge-sha-999',
  repo: { owner: 'test-org', repo: 'test-repo' }
};

const parentManifest: Manifest = { Button: 'h-button', Modal: 'h-modal' };

describe('manifestMerge', () => {
  beforeEach(() => {
    getManifestMock.mockReset();
    putManifestMock.mockReset().mockResolvedValue(undefined);
    getChangesetMock.mockReset();
    getMergeParentShaMock.mockReset();
    flagOverlappingOpenPrsMock.mockReset().mockResolvedValue([]);
    applyChangesetToBaseImagesMock.mockReset().mockResolvedValue(undefined);
    overlayChangesetMock.mockReset();
    detectStaleConflictsMock.mockReset().mockReturnValue([]);
    infoMock.mockReset();
    setFailedMock.mockReset();
    warningMock.mockReset();
  });

  describe('no changeset (PR had no visual changes)', () => {
    beforeEach(() => {
      getChangesetMock.mockResolvedValue(null);
      getMergeParentShaMock.mockResolvedValue('parent-sha-aaa');
      getManifestMock.mockResolvedValue(parentManifest);
    });

    it('writes parent manifest unchanged at the merge commit SHA', async () => {
      await manifestMerge(params, makeDeps());

      expect(putManifestMock).toHaveBeenCalledTimes(1);
      expect(putManifestMock).toHaveBeenCalledWith(
        'test-bucket',
        'merge-sha-999',
        parentManifest
      );
    });

    it('does not flag open PRs, overlay, or apply to base images', async () => {
      await manifestMerge(params, makeDeps());

      expect(flagOverlappingOpenPrsMock).not.toHaveBeenCalled();
      expect(overlayChangesetMock).not.toHaveBeenCalled();
      expect(applyChangesetToBaseImagesMock).not.toHaveBeenCalled();
    });
  });

  describe('changeset present, _headSha matches parent', () => {
    const changeset: Changeset = {
      _headSha: 'parent-sha-aaa',
      Button: 'h-button-new'
    };
    const overlaid: Manifest = { Button: 'h-button-new', Modal: 'h-modal' };

    beforeEach(() => {
      getChangesetMock.mockResolvedValue(changeset);
      getMergeParentShaMock.mockResolvedValue('parent-sha-aaa');
      getManifestMock.mockResolvedValue(parentManifest);
      overlayChangesetMock.mockReturnValue(overlaid);
    });

    it('flags overlapping open PRs', async () => {
      await manifestMerge(params, makeDeps());

      expect(flagOverlappingOpenPrsMock).toHaveBeenCalledTimes(1);
      expect(flagOverlappingOpenPrsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: 'test-bucket',
          repo: params.repo,
          mergingPrNumber: 100,
          mergingChangeset: changeset
        })
      );
    });

    it('does not run the stale-conflict check', async () => {
      await manifestMerge(params, makeDeps());

      expect(detectStaleConflictsMock).not.toHaveBeenCalled();
    });

    it('overlays the changeset and writes the resulting manifest', async () => {
      await manifestMerge(params, makeDeps());

      expect(overlayChangesetMock).toHaveBeenCalledWith(
        parentManifest,
        changeset
      );
      expect(putManifestMock).toHaveBeenCalledWith(
        'test-bucket',
        'merge-sha-999',
        overlaid
      );
    });

    it('applies the changeset to base images', async () => {
      await manifestMerge(params, makeDeps());

      expect(applyChangesetToBaseImagesMock).toHaveBeenCalledTimes(1);
      expect(applyChangesetToBaseImagesMock).toHaveBeenCalledWith({
        bucket: 'test-bucket',
        prSha: 'pr-sha-111',
        changeset
      });
    });
  });

  describe('changeset present, _headSha differs from parent (intervening merges)', () => {
    const changeset: Changeset = {
      _headSha: 'old-head-sha',
      Button: 'h-button-new'
    };
    const headManifest: Manifest = { Button: 'h-button-old' };
    const overlaid: Manifest = { Button: 'h-button-new', Modal: 'h-modal' };

    function setupHappyPath() {
      getChangesetMock.mockResolvedValue(changeset);
      getMergeParentShaMock.mockResolvedValue('parent-sha-aaa');
      // First getManifest call: parent. Second: head (for stale check).
      getManifestMock
        .mockResolvedValueOnce(parentManifest)
        .mockResolvedValueOnce(headManifest);
      overlayChangesetMock.mockReturnValue(overlaid);
      detectStaleConflictsMock.mockReturnValue([]);
    }

    it('runs stale-conflict check using head and parent manifests', async () => {
      setupHappyPath();

      await manifestMerge(params, makeDeps());

      expect(detectStaleConflictsMock).toHaveBeenCalledTimes(1);
      expect(detectStaleConflictsMock).toHaveBeenCalledWith(
        headManifest,
        parentManifest,
        changeset
      );
    });

    it('proceeds with overlay and base-image apply when no conflicts', async () => {
      setupHappyPath();

      await manifestMerge(params, makeDeps());

      expect(putManifestMock).toHaveBeenCalledWith(
        'test-bucket',
        'merge-sha-999',
        overlaid
      );
      expect(applyChangesetToBaseImagesMock).toHaveBeenCalledTimes(1);
    });

    it('fails the job and aborts when stale conflicts are detected', async () => {
      getChangesetMock.mockResolvedValue(changeset);
      getMergeParentShaMock.mockResolvedValue('parent-sha-aaa');
      getManifestMock
        .mockResolvedValueOnce(parentManifest)
        .mockResolvedValueOnce(headManifest);
      detectStaleConflictsMock.mockReturnValue(['Button']);

      await expect(manifestMerge(params, makeDeps())).rejects.toThrow(
        /stale|conflict|Button/i
      );

      expect(setFailedMock).toHaveBeenCalled();
      expect(overlayChangesetMock).not.toHaveBeenCalled();
      expect(putManifestMock).not.toHaveBeenCalled();
      expect(applyChangesetToBaseImagesMock).not.toHaveBeenCalled();
    });
  });

  it('treats a missing parent manifest as an empty manifest', async () => {
    const changeset: Changeset = {
      _headSha: 'parent-sha-aaa',
      NewThing: 'h-new'
    };
    getChangesetMock.mockResolvedValue(changeset);
    getMergeParentShaMock.mockResolvedValue('parent-sha-aaa');
    getManifestMock.mockResolvedValue(null);
    overlayChangesetMock.mockReturnValue({ NewThing: 'h-new' });

    await manifestMerge(params, makeDeps());

    expect(overlayChangesetMock).toHaveBeenCalledWith({}, changeset);
    expect(putManifestMock).toHaveBeenCalledWith(
      'test-bucket',
      'merge-sha-999',
      { NewThing: 'h-new' }
    );
  });
});
