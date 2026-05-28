/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  classifyManifests,
  type CompareResult,
  type ClassifyDeps
} from '../src/manifest-compare-classify';

const getObjectMock = mock<any>();
const getBranchMock = mock<any>();
const compareMock = mock<any>();
const infoMock = mock<any>();

function makeDeps(overrides: Partial<ClassifyDeps> = {}): ClassifyDeps {
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

describe('classifyManifests', () => {
  beforeEach(() => {
    getObjectMock.mockReset();
    getBranchMock.mockReset();
    compareMock.mockReset();
    infoMock.mockReset();
  });

  it('returns match when PR and HEAD manifests are identical', async () => {
    const manifest = { Button: 'hash1', Modal: 'hash2' };

    // PR manifest
    mockManifest(manifest);
    // HEAD SHA
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    // HEAD manifest
    mockManifest(manifest);

    const result = await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({ outcome: 'match' });
  });

  it('classifies as prOwns when HEAD equals ancestor but PR differs', async () => {
    const ancestorManifest = { Button: 'hash1' };
    const headManifest = { Button: 'hash1' };
    const prManifest = { Button: 'hash2' };

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

    const result = await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [{ path: 'Button', type: 'changed' }],
      mainOwns: [],
      conflicts: []
    });
  });

  it('classifies as prOwns with type added when screenshot is new', async () => {
    const ancestorManifest = {};
    const headManifest = {};
    const prManifest = { NewComponent: 'hash1' };

    mockManifest(prManifest);
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    mockManifest(headManifest);
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    mockManifest(ancestorManifest);

    const result = await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [{ path: 'NewComponent', type: 'added' }],
      mainOwns: [],
      conflicts: []
    });
  });

  it('classifies as prOwns with type deleted when PR removes a screenshot', async () => {
    const ancestorManifest = { Removed: 'hash1' };
    const headManifest = { Removed: 'hash1' };
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

    const result = await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [{ path: 'Removed', type: 'deleted' }],
      mainOwns: [],
      conflicts: []
    });
  });

  it('classifies as mainOwns when PR equals ancestor but HEAD differs', async () => {
    const ancestorManifest = { Button: 'hash1' };
    const headManifest = { Button: 'hash3' };
    const prManifest = { Button: 'hash1' };

    mockManifest(prManifest);
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    mockManifest(headManifest);
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    mockManifest(ancestorManifest);

    const result = await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [],
      mainOwns: ['Button'],
      conflicts: []
    });
  });

  it('classifies as mainOwns when screenshot was added on main only', async () => {
    const ancestorManifest = {};
    const headManifest = { MainOnly: 'hash1' };
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

    const result = await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [],
      mainOwns: ['MainOnly'],
      conflicts: []
    });
  });

  it('classifies as conflict when all three manifests differ', async () => {
    const ancestorManifest = { Button: 'hash1' };
    const headManifest = { Button: 'hash2' };
    const prManifest = { Button: 'hash3' };

    mockManifest(prManifest);
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    mockManifest(headManifest);
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });
    mockManifest(ancestorManifest);

    const result = await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    );

    expect(result).toEqual({
      outcome: 'classified',
      headSha: 'head-sha-222',
      prSha,
      prOwns: [],
      mainOwns: [],
      conflicts: ['Button']
    });
  });

  it('classifies multiple screenshots into different categories', async () => {
    const ancestorManifest = {
      Button: 'hash1',
      Modal: 'hash2',
      Card: 'hash3'
    };
    const headManifest = {
      Button: 'hash1',
      Modal: 'hash2-main',
      Card: 'hash3-main'
    };
    const prManifest = {
      Button: 'hash1-pr',
      Modal: 'hash2',
      Card: 'hash3-pr'
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

    const result = (await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    )) as Extract<CompareResult, { outcome: 'classified' }>;

    expect(result.prOwns).toEqual([{ path: 'Button', type: 'changed' }]);
    expect(result.mainOwns).toEqual(['Modal']);
    expect(result.conflicts).toEqual(['Card']);
  });

  it('fails when ancestor manifest is missing', async () => {
    const headManifest = { Button: 'hash1' };
    const prManifest = { Button: 'hash2' };

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
      classifyManifests(
        { bucket: 'test-bucket', prSha, repo, baseRef },
        makeDeps()
      )
    ).rejects.toThrow(/rebase/i);
  });

  it('fails when PR manifest is missing', async () => {
    mockNoSuchKey();

    await expect(
      classifyManifests(
        { bucket: 'test-bucket', prSha, repo, baseRef },
        makeDeps()
      )
    ).rejects.toThrow();
  });

  it('treats missing HEAD manifest as empty (first run on main)', async () => {
    const prManifest = { Button: 'hash1' };

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
      classifyManifests(
        { bucket: 'test-bucket', prSha, repo, baseRef },
        makeDeps()
      )
    ).rejects.toThrow(/rebase/i);
  });
});
