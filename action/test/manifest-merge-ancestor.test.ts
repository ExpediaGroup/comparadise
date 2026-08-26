/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  findAncestorManifest,
  type FindAncestorManifestDeps
} from '../src/manifest-merge-ancestor';
import type { Manifest } from '../src/manifest-s3';

const getManifestMock = mock<any>();
const getParentShaMock = mock<any>();
const warningMock = mock<any>();

function makeDeps(
  overrides: Partial<FindAncestorManifestDeps> = {}
): FindAncestorManifestDeps {
  return {
    getManifest: getManifestMock,
    getParentSha: getParentShaMock,
    core: { warning: warningMock },
    ...overrides
  };
}

const bucket = 'test-bucket';

describe('findAncestorManifest', () => {
  beforeEach(() => {
    getManifestMock.mockReset();
    getParentShaMock.mockReset();
    warningMock.mockReset();
  });

  it('returns the manifest at startSha when it exists', async () => {
    const manifest: Manifest = { Button: 'h-button' };
    getManifestMock.mockResolvedValue(manifest);

    const result = await findAncestorManifest(bucket, 'sha-a', makeDeps());

    expect(result).toBe(manifest);
    expect(getParentShaMock).not.toHaveBeenCalled();
  });

  it('walks back through ancestors that have no manifest until one is found', async () => {
    const manifest: Manifest = { Button: 'h-button' };
    getManifestMock.mockImplementation(async (_bucket: string, sha: string) =>
      sha === 'sha-c' ? manifest : null
    );
    getParentShaMock.mockImplementation(async (sha: string) => {
      if (sha === 'sha-a') return 'sha-b';
      if (sha === 'sha-b') return 'sha-c';
      return null;
    });

    const result = await findAncestorManifest(bucket, 'sha-a', makeDeps());

    expect(result).toBe(manifest);
    expect(getManifestMock).toHaveBeenCalledTimes(3);
    expect(getManifestMock).toHaveBeenNthCalledWith(1, bucket, 'sha-a');
    expect(getManifestMock).toHaveBeenNthCalledWith(2, bucket, 'sha-b');
    expect(getManifestMock).toHaveBeenNthCalledWith(3, bucket, 'sha-c');
    expect(warningMock).not.toHaveBeenCalled();
  });

  it('returns {} without warning once real history is exhausted (bootstrap case)', async () => {
    getManifestMock.mockResolvedValue(null);
    getParentShaMock
      .mockResolvedValueOnce('sha-root-minus-1')
      .mockResolvedValueOnce(null);

    const result = await findAncestorManifest(bucket, 'sha-a', makeDeps());

    expect(result).toEqual({});
    expect(warningMock).not.toHaveBeenCalled();
  });

  it('gives up and warns after the max walk depth without exhausting real history', async () => {
    getManifestMock.mockResolvedValue(null);
    getParentShaMock.mockImplementation(async (sha: string) => `${sha}-parent`);

    const result = await findAncestorManifest(bucket, 'sha-a', makeDeps());

    expect(result).toEqual({});
    expect(warningMock).toHaveBeenCalledWith(expect.stringContaining('sha-a'));
  });
});
