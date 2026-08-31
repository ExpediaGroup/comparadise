/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { generateDiffs, type GenerateDiffsDeps } from '../src/manifest-diff';
import type { PrOwnsEntry } from '../src/manifest-compare-classify';

const getObjectMock = mock<any>();
const putObjectMock = mock<any>();
const infoMock = mock<any>();
const diffPngMock = mock<any>();

function makeDeps(
  overrides: Partial<GenerateDiffsDeps> = {}
): GenerateDiffsDeps {
  return {
    s3: { getObject: getObjectMock, putObject: putObjectMock } as any,
    core: { info: infoMock } as any,
    diffPng: diffPngMock,
    ...overrides
  };
}

function mockS3Download(body: Buffer) {
  getObjectMock.mockResolvedValueOnce({
    Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(body)) }
  });
}

const bucket = 'test-bucket';
const prSha = 'pr-sha-111';

describe('generateDiffs', () => {
  beforeEach(() => {
    getObjectMock.mockReset();
    putObjectMock.mockReset().mockResolvedValue({});
    infoMock.mockReset();
    diffPngMock.mockReset();
  });

  it('generates and uploads diff for changed entries', async () => {
    const prOwns: PrOwnsEntry[] = [
      { path: 'components/Button', type: 'changed' }
    ];

    const baseBuffer = Buffer.from('base-image');
    const newBuffer = Buffer.from('new-image');
    const diffBuffer = Buffer.from('diff-image');

    // Download base
    mockS3Download(baseBuffer);
    // Download new
    mockS3Download(newBuffer);
    // Pixelmatch produces diff
    diffPngMock.mockReturnValue({ diffBuffer, diffPixels: 42 });

    const outcome = await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

    expect(outcome).toEqual({ diffed: ['components/Button'], identical: [] });
    expect(getObjectMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: 'base-images/components/Button/base.png'
    });
    expect(getObjectMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: 'new-images/pr-sha-111/components/Button/new.png'
    });
    expect(diffPngMock).toHaveBeenCalledWith(baseBuffer, newBuffer);
    expect(putObjectMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: 'new-images/pr-sha-111/components/Button/base.png',
      Body: baseBuffer
    });
    expect(putObjectMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: 'new-images/pr-sha-111/components/Button/diff.png',
      Body: diffBuffer
    });
  });

  it('skips added entries — no base or diff needed', async () => {
    const prOwns: PrOwnsEntry[] = [
      { path: 'components/NewThing', type: 'added' }
    ];

    const outcome = await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

    expect(outcome).toEqual({ diffed: [], identical: [] });
    expect(getObjectMock).not.toHaveBeenCalled();
    expect(putObjectMock).not.toHaveBeenCalled();
    expect(diffPngMock).not.toHaveBeenCalled();
  });

  it('skips deleted entries — no images to upload', async () => {
    const prOwns: PrOwnsEntry[] = [
      { path: 'components/Removed', type: 'deleted' }
    ];

    const outcome = await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

    expect(outcome).toEqual({ diffed: [], identical: [] });
    expect(getObjectMock).not.toHaveBeenCalled();
    expect(putObjectMock).not.toHaveBeenCalled();
    expect(diffPngMock).not.toHaveBeenCalled();
  });

  it('processes multiple changed entries', async () => {
    const prOwns: PrOwnsEntry[] = [
      { path: 'Button', type: 'changed' },
      { path: 'Modal', type: 'changed' },
      { path: 'NewThing', type: 'added' }
    ];

    mockS3Download(Buffer.from('button-base'));
    mockS3Download(Buffer.from('button-new'));
    mockS3Download(Buffer.from('modal-base'));
    mockS3Download(Buffer.from('modal-new'));
    diffPngMock.mockReturnValue({
      diffBuffer: Buffer.from('diff'),
      diffPixels: 42
    });

    const outcome = await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

    expect(outcome).toEqual({ diffed: ['Button', 'Modal'], identical: [] });
    const putCalls = putObjectMock.mock.calls;
    expect(putCalls).toHaveLength(4); // 2 base + 2 diff uploads
  });

  describe('new image visually identical to base image', () => {
    it('reports the path as identical and uploads nothing', async () => {
      const prOwns: PrOwnsEntry[] = [
        { path: 'components/Button', type: 'changed' }
      ];

      const sameBytes = Buffer.from('same-image');
      mockS3Download(sameBytes);
      mockS3Download(Buffer.from('same-image'));

      const outcome = await generateDiffs(
        { bucket, prSha, prOwns },
        makeDeps()
      );

      expect(outcome).toEqual({
        diffed: [],
        identical: ['components/Button']
      });
      expect(diffPngMock).not.toHaveBeenCalled();
      expect(putObjectMock).not.toHaveBeenCalled();
    });

    it('still diffs the entries that genuinely differ', async () => {
      const prOwns: PrOwnsEntry[] = [
        { path: 'Button', type: 'changed' },
        { path: 'Modal', type: 'changed' }
      ];

      mockS3Download(Buffer.from('drifted')); // Button base
      mockS3Download(Buffer.from('drifted')); // Button new — identical
      mockS3Download(Buffer.from('modal-base'));
      mockS3Download(Buffer.from('modal-new'));
      diffPngMock.mockReturnValue({
        diffBuffer: Buffer.from('diff'),
        diffPixels: 42
      });

      const outcome = await generateDiffs(
        { bucket, prSha, prOwns },
        makeDeps()
      );

      expect(outcome).toEqual({ diffed: ['Modal'], identical: ['Button'] });
      expect(diffPngMock).toHaveBeenCalledTimes(1);
      expect(
        putObjectMock.mock.calls.map(call => (call[0] as any).Key)
      ).toEqual([
        'new-images/pr-sha-111/Modal/base.png',
        'new-images/pr-sha-111/Modal/diff.png'
      ]);
    });

    it('reports the path as identical when the bytes differ but no pixel does', async () => {
      const prOwns: PrOwnsEntry[] = [
        { path: 'components/Button', type: 'changed' }
      ];

      mockS3Download(Buffer.from('base-image'));
      mockS3Download(Buffer.from('new-image'));
      diffPngMock.mockReturnValue({
        diffBuffer: Buffer.from('empty-diff'),
        diffPixels: 0
      });

      const outcome = await generateDiffs(
        { bucket, prSha, prOwns },
        makeDeps()
      );

      expect(outcome).toEqual({
        diffed: [],
        identical: ['components/Button']
      });
      expect(diffPngMock).toHaveBeenCalledTimes(1);
      expect(putObjectMock).not.toHaveBeenCalled();
    });

    it('separates pixel-identical paths from genuinely changed ones', async () => {
      const prOwns: PrOwnsEntry[] = [
        { path: 'Button', type: 'changed' },
        { path: 'Modal', type: 'changed' }
      ];

      mockS3Download(Buffer.from('button-base'));
      mockS3Download(Buffer.from('button-new'));
      mockS3Download(Buffer.from('modal-base'));
      mockS3Download(Buffer.from('modal-new'));
      diffPngMock
        .mockReturnValueOnce({
          diffBuffer: Buffer.from('empty-diff'),
          diffPixels: 0
        })
        .mockReturnValueOnce({
          diffBuffer: Buffer.from('diff'),
          diffPixels: 42
        });

      const outcome = await generateDiffs(
        { bucket, prSha, prOwns },
        makeDeps()
      );

      expect(outcome).toEqual({ diffed: ['Modal'], identical: ['Button'] });
      expect(
        putObjectMock.mock.calls.map(call => (call[0] as any).Key)
      ).toEqual([
        'new-images/pr-sha-111/Modal/base.png',
        'new-images/pr-sha-111/Modal/diff.png'
      ]);
    });
  });
});
