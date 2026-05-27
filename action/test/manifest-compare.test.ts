/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  manifestCompare,
  type CompareResult,
  type ManifestCompareDeps
} from '../src/manifest-compare';

const getObjectMock = mock<any>();
const getBranchMock = mock<any>();
const compareMock = mock<any>();
const infoMock = mock<any>();

function makeDeps(
  overrides: Partial<ManifestCompareDeps> = {}
): ManifestCompareDeps {
  return {
    s3: { getObject: getObjectMock } as any,
    octokit: {
      rest: {
        repos: {
          getBranch: getBranchMock,
          compareCommitsWithBasehead: compareMock
        }
      }
    } as any,
    core: { info: infoMock, setFailed: mock() } as any,
    ...overrides
  };
}

function mockManifest(manifest: Record<string, string>) {
  getObjectMock.mockResolvedValueOnce({
    Body: {
      transformToString: () => Promise.resolve(JSON.stringify(manifest))
    }
  });
}

function mockNoSuchKey() {
  const error = new Error('NoSuchKey');
  error.name = 'NoSuchKey';
  getObjectMock.mockRejectedValueOnce(error);
}

const repo = { owner: 'test-org', repo: 'test-repo' };
const baseRef = 'main';
const prSha = 'pr-sha-111';

describe('manifestCompare', () => {
  beforeEach(() => {
    getObjectMock.mockReset();
    getBranchMock.mockReset();
    compareMock.mockReset();
    infoMock.mockReset();
  });

  it('returns match when PR and HEAD manifests are identical', async () => {
    const manifest = { 'Button/new.png': 'hash1', 'Modal/new.png': 'hash2' };

    // PR manifest
    mockManifest(manifest);
    // HEAD SHA
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    // HEAD manifest
    mockManifest(manifest);

    const result = await manifestCompare(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({ outcome: 'match' });
  });

  it('classifies as prOwns when HEAD equals ancestor but PR differs', async () => {
    const ancestorManifest = { 'Button/new.png': 'hash1' };
    const headManifest = { 'Button/new.png': 'hash1' };
    const prManifest = { 'Button/new.png': 'hash2' };

    // PR manifest
    mockManifest(prManifest);
    // HEAD SHA
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    // HEAD manifest
    mockManifest(headManifest);
    // Ancestor SHA
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    // Ancestor manifest
    mockManifest(ancestorManifest);

    const result = await manifestCompare(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [{ path: 'Button/new.png', type: 'changed' }],
      mainOwns: [],
      conflicts: []
    });
  });

  it('classifies as prOwns with type added when screenshot is new', async () => {
    const ancestorManifest = {};
    const headManifest = {};
    const prManifest = { 'NewComponent/new.png': 'hash1' };

    mockManifest(prManifest);
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    mockManifest(headManifest);
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    mockManifest(ancestorManifest);

    const result = await manifestCompare(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [{ path: 'NewComponent/new.png', type: 'added' }],
      mainOwns: [],
      conflicts: []
    });
  });

  it('classifies as prOwns with type deleted when PR removes a screenshot', async () => {
    const ancestorManifest = { 'Removed/new.png': 'hash1' };
    const headManifest = { 'Removed/new.png': 'hash1' };
    const prManifest = {};

    mockManifest(prManifest);
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    mockManifest(headManifest);
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    mockManifest(ancestorManifest);

    const result = await manifestCompare(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [{ path: 'Removed/new.png', type: 'deleted' }],
      mainOwns: [],
      conflicts: []
    });
  });

  it('classifies as mainOwns when PR equals ancestor but HEAD differs', async () => {
    const ancestorManifest = { 'Button/new.png': 'hash1' };
    const headManifest = { 'Button/new.png': 'hash3' };
    const prManifest = { 'Button/new.png': 'hash1' };

    mockManifest(prManifest);
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    mockManifest(headManifest);
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    mockManifest(ancestorManifest);

    const result = await manifestCompare(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [],
      mainOwns: ['Button/new.png'],
      conflicts: []
    });
  });

  it('classifies as mainOwns when screenshot was added on main only', async () => {
    const ancestorManifest = {};
    const headManifest = { 'MainOnly/new.png': 'hash1' };
    const prManifest = {};

    mockManifest(prManifest);
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    mockManifest(headManifest);
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    mockManifest(ancestorManifest);

    const result = await manifestCompare(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [],
      mainOwns: ['MainOnly/new.png'],
      conflicts: []
    });
  });

  it('classifies as conflict when all three manifests differ', async () => {
    const ancestorManifest = { 'Button/new.png': 'hash1' };
    const headManifest = { 'Button/new.png': 'hash2' };
    const prManifest = { 'Button/new.png': 'hash3' };

    mockManifest(prManifest);
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    mockManifest(headManifest);
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    mockManifest(ancestorManifest);

    const result = await manifestCompare(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [],
      mainOwns: [],
      conflicts: ['Button/new.png']
    });
  });

  it('classifies multiple screenshots into different categories', async () => {
    const ancestorManifest = {
      'Button/new.png': 'hash1',
      'Modal/new.png': 'hash2',
      'Card/new.png': 'hash3'
    };
    const headManifest = {
      'Button/new.png': 'hash1',
      'Modal/new.png': 'hash2-main',
      'Card/new.png': 'hash3-main'
    };
    const prManifest = {
      'Button/new.png': 'hash1-pr',
      'Modal/new.png': 'hash2',
      'Card/new.png': 'hash3-pr'
    };

    mockManifest(prManifest);
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    mockManifest(headManifest);
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    mockManifest(ancestorManifest);

    const result = (await manifestCompare(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    )) as Extract<CompareResult, { outcome: 'classified' }>;

    expect(result.prOwns).toEqual([
      { path: 'Button/new.png', type: 'changed' }
    ]);
    expect(result.mainOwns).toEqual(['Modal/new.png']);
    expect(result.conflicts).toEqual(['Card/new.png']);
  });

  it('fails when ancestor manifest is missing', async () => {
    const headManifest = { 'Button/new.png': 'hash1' };
    const prManifest = { 'Button/new.png': 'hash2' };

    mockManifest(prManifest);
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    mockManifest(headManifest);
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    // Ancestor manifest missing
    mockNoSuchKey();

    await expect(
      manifestCompare(
        { bucket: 'test-bucket', prSha, repo, baseRef },
        makeDeps()
      )
    ).rejects.toThrow(/rebase/i);
  });

  it('fails when PR manifest is missing', async () => {
    mockNoSuchKey();

    await expect(
      manifestCompare(
        { bucket: 'test-bucket', prSha, repo, baseRef },
        makeDeps()
      )
    ).rejects.toThrow();
  });

  it('treats missing HEAD manifest as empty (first run on main)', async () => {
    const prManifest = { 'Button/new.png': 'hash1' };

    // PR manifest
    mockManifest(prManifest);
    // HEAD SHA
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    // HEAD manifest missing — first time running on main
    mockNoSuchKey();
    // Ancestor SHA
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    // Ancestor manifest missing too
    mockNoSuchKey();

    await expect(
      manifestCompare(
        { bucket: 'test-bucket', prSha, repo, baseRef },
        makeDeps()
      )
    ).rejects.toThrow(/rebase/i);
  });
});
