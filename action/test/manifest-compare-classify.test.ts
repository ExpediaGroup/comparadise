/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  classifyManifests,
  type CompareResult,
  type ClassifyDeps
} from '../src/manifest-compare-classify';
import { makeManifestS3 } from '../src/manifest-s3';
import { findAncestorManifest } from '../src/manifest-merge-ancestor';

const getObjectMock = mock<any>();
const getBranchMock = mock<any>();
const compareMock = mock<any>();
const infoMock = mock<any>();

// getManifest is injected (see F5 dedupe); back it with the real makeManifestS3
// over the same getObject mock so the ordered mockManifest/mockNoSuchKey
// sequencing below drives it exactly as it did the removed local copy.
const getManifest = makeManifestS3({
  getObject: getObjectMock
} as any).getManifest;

function makeDeps(overrides: Partial<ClassifyDeps> = {}): ClassifyDeps {
  const resolvedGetManifest = overrides.getManifest ?? getManifest;
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
    core: { info: infoMock, setFailed: mock(), warning: mock() } as any,
    getManifest: resolvedGetManifest,
    // No gap-bridging in these tests — the exact sha's manifest either
    // exists or the walk immediately bottoms out at {} (see
    // manifest-merge-ancestor.test.ts for the walk itself).
    getAncestorManifest: async (bucket, sha) =>
      (await resolvedGetManifest(bucket, sha)) ?? {},
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
      prOwns: [{ path: 'Button', type: 'changed', baseHash: 'hash1' }],
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
      prOwns: [{ path: 'NewComponent', type: 'added', baseHash: null }],
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
      prOwns: [{ path: 'Removed', type: 'deleted', baseHash: 'hash1' }],
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

    expect(result.prOwns).toEqual([
      { path: 'Button', type: 'changed', baseHash: 'hash1' }
    ]);
    expect(result.mainOwns).toEqual(['Modal']);
    expect(result.conflicts).toEqual(['Card']);
  });

  it('classifies as a conflict when ancestor manifest is missing but PR and HEAD differ', async () => {
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

    const result = (await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    )) as Extract<CompareResult, { outcome: 'classified' }>;

    expect(result.conflicts).toEqual(['Button']);
    expect(result.prOwns).toEqual([]);
    expect(result.mainOwns).toEqual([]);
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

  it('reads every manifest through the injected getManifest, not S3 directly', async () => {
    const getManifestSpy = mock<any>()
      .mockResolvedValueOnce({ Button: 'hash2' }) // PR
      .mockResolvedValueOnce({ Button: 'hash1' }) // HEAD
      .mockResolvedValueOnce({ Button: 'hash1' }); // ancestor
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-222' } }
    });
    compareMock.mockResolvedValue({
      data: { merge_base_commit: { sha: 'ancestor-sha-333' } }
    });

    await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps({ getManifest: getManifestSpy })
    );

    expect(getManifestSpy).toHaveBeenCalledWith('test-bucket', prSha);
    expect(getManifestSpy).toHaveBeenCalledWith('test-bucket', 'head-sha-222');
    expect(getManifestSpy).toHaveBeenCalledWith(
      'test-bucket',
      'ancestor-sha-333'
    );
    // The duplicated local getManifestFromS3 is gone — no direct S3 reads.
    expect(getObjectMock).not.toHaveBeenCalled();
  });

  it('treats missing HEAD and ancestor manifests as an empty baseline (first run of manifest mode)', async () => {
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

    const result = (await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps()
    )) as Extract<CompareResult, { outcome: 'classified' }>;

    expect(result.prOwns).toEqual([
      { path: 'Button', type: 'added', baseHash: null }
    ]);
    expect(result.mainOwns).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it('bridges a manifest-merge gap at HEAD via a real ancestor walk instead of seeing it as an empty baseline', async () => {
    // main's current tip commit never got a manifest written (e.g. its push
    // didn't touch a comparadise-relevant path), but its parent has the real,
    // still-current baseline. Wiring the real findAncestorManifest in (rather
    // than the test's default single-hop wrapper) must find it.
    const realBaseline = { Button: 'hash1' };
    const prManifest = { Button: 'hash1' };

    mockManifest(prManifest); // PR manifest
    getBranchMock.mockResolvedValue({
      data: { commit: { sha: 'head-sha-with-gap' } }
    });
    mockNoSuchKey(); // no manifest at head-sha-with-gap itself
    mockManifest(realBaseline); // its parent has the real baseline

    const getParentSha = mock<any>().mockImplementation(async (sha: string) =>
      sha === 'head-sha-with-gap' ? 'good-parent' : null
    );

    const result = await classifyManifests(
      { bucket: 'test-bucket', prSha, repo, baseRef },
      makeDeps({
        getAncestorManifest: (bucket, startSha) =>
          findAncestorManifest(bucket, startSha, {
            getManifest,
            getParentSha,
            core: { warning: mock() } as any
          })
      })
    );

    // PR manifest matches the real (walked-back) baseline exactly — no diff.
    expect(result).toEqual({ outcome: 'match' });
  });
});
