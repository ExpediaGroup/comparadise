/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { generateDiffs, type GenerateDiffsDeps } from '../src/manifest-diff';
import type { PrOwnsEntry } from '../src/manifest-compare-classify';
import { makeBaseImageReader } from '../src/manifest-base-images';

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
    getBaseImage: makeBaseImageReader({
      s3: { getObject: getObjectMock } as any,
      core: { info: infoMock } as any
    }).getBaseImage,
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
      { path: 'components/Button', type: 'changed', baseHash: 'h-base' }
    ];

    const baseBuffer = Buffer.from('base-image');
    const newBuffer = Buffer.from('new-image');
    const diffBuffer = Buffer.from('diff-image');

    // Download base
    mockS3Download(baseBuffer);
    // Download new
    mockS3Download(newBuffer);
    // Pixelmatch produces diff
    diffPngMock.mockReturnValue(diffBuffer);

    const outcome = await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

    expect(outcome).toEqual({ diffed: ['components/Button'], identical: [] });
    expect(getObjectMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: 'base-images/components/Button/h-base.png'
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
      { path: 'components/NewThing', type: 'added', baseHash: null }
    ];

    const outcome = await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

    expect(outcome).toEqual({ diffed: [], identical: [] });
    expect(getObjectMock).not.toHaveBeenCalled();
    expect(putObjectMock).not.toHaveBeenCalled();
    expect(diffPngMock).not.toHaveBeenCalled();
  });

  it('skips deleted entries — no images to upload', async () => {
    const prOwns: PrOwnsEntry[] = [
      { path: 'components/Removed', type: 'deleted', baseHash: 'h-removed' }
    ];

    const outcome = await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

    expect(outcome).toEqual({ diffed: [], identical: [] });
    expect(getObjectMock).not.toHaveBeenCalled();
    expect(putObjectMock).not.toHaveBeenCalled();
    expect(diffPngMock).not.toHaveBeenCalled();
  });

  it('processes multiple changed entries', async () => {
    const prOwns: PrOwnsEntry[] = [
      { path: 'Button', type: 'changed', baseHash: 'h-button' },
      { path: 'Modal', type: 'changed', baseHash: 'h-modal' },
      { path: 'NewThing', type: 'added', baseHash: null }
    ];

    mockS3Download(Buffer.from('button-base'));
    mockS3Download(Buffer.from('button-new'));
    mockS3Download(Buffer.from('modal-base'));
    mockS3Download(Buffer.from('modal-new'));
    diffPngMock.mockReturnValue(Buffer.from('diff'));

    const outcome = await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

    expect(outcome).toEqual({ diffed: ['Button', 'Modal'], identical: [] });
    const putCalls = putObjectMock.mock.calls;
    expect(putCalls).toHaveLength(4); // 2 base + 2 diff uploads
  });

  describe('base image resolution', () => {
    // A dedicated getObject mock for the base image, so the base and new
    // downloads — which generateDiffs issues concurrently — cannot consume
    // each other's queued responses.
    function makeDepsWithBaseMock(baseGetObject: ReturnType<typeof mock<any>>) {
      return makeDeps({
        getBaseImage: makeBaseImageReader({
          s3: { getObject: baseGetObject } as any,
          core: { info: infoMock } as any
        }).getBaseImage
      });
    }

    function mockBaseDownload(
      baseGetObject: ReturnType<typeof mock<any>>,
      body: Buffer
    ) {
      baseGetObject.mockResolvedValueOnce({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array(body))
        }
      });
    }

    it('reads the base image named for the hash the base branch recorded', async () => {
      const prOwns: PrOwnsEntry[] = [
        { path: 'components/Button', type: 'changed', baseHash: 'abc123' }
      ];
      const baseGetObject = mock<any>();

      mockBaseDownload(baseGetObject, Buffer.from('base'));
      mockS3Download(Buffer.from('new'));
      diffPngMock.mockReturnValue(Buffer.from('diff'));

      await generateDiffs(
        { bucket, prSha, prOwns },
        makeDepsWithBaseMock(baseGetObject)
      );

      expect(baseGetObject).toHaveBeenCalledWith({
        Bucket: bucket,
        Key: 'base-images/components/Button/abc123.png'
      });
    });

    it('falls back to the legacy base.png when no hash-named image exists yet', async () => {
      const prOwns: PrOwnsEntry[] = [
        { path: 'components/Button', type: 'changed', baseHash: 'abc123' }
      ];
      const baseGetObject = mock<any>();

      const noSuchKey = new Error('not found');
      noSuchKey.name = 'NoSuchKey';
      baseGetObject.mockRejectedValueOnce(noSuchKey);
      mockBaseDownload(baseGetObject, Buffer.from('legacy-base'));
      mockS3Download(Buffer.from('new'));
      diffPngMock.mockReturnValue(Buffer.from('diff'));

      const outcome = await generateDiffs(
        { bucket, prSha, prOwns },
        makeDepsWithBaseMock(baseGetObject)
      );

      expect(outcome).toEqual({ diffed: ['components/Button'], identical: [] });
      expect(
        baseGetObject.mock.calls.map(call => (call[0] as any).Key)
      ).toEqual([
        'base-images/components/Button/abc123.png',
        'base-images/components/Button/base.png'
      ]);
      expect(diffPngMock).toHaveBeenCalledWith(
        Buffer.from('legacy-base'),
        Buffer.from('new')
      );
    });

    it('propagates S3 errors that are not a missing key', async () => {
      const prOwns: PrOwnsEntry[] = [
        { path: 'components/Button', type: 'changed', baseHash: 'abc123' }
      ];
      const baseGetObject = mock<any>();

      baseGetObject.mockRejectedValue(new Error('AccessDenied'));
      mockS3Download(Buffer.from('new'));

      await expect(
        generateDiffs(
          { bucket, prSha, prOwns },
          makeDepsWithBaseMock(baseGetObject)
        )
      ).rejects.toThrow('AccessDenied');
    });
  });

  describe('base image byte-identical to new image', () => {
    it('reports the path as identical and uploads nothing', async () => {
      const prOwns: PrOwnsEntry[] = [
        { path: 'components/Button', type: 'changed', baseHash: 'h-base' }
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
        { path: 'Button', type: 'changed', baseHash: 'h-button' },
        { path: 'Modal', type: 'changed', baseHash: 'h-modal' }
      ];

      mockS3Download(Buffer.from('drifted')); // Button base
      mockS3Download(Buffer.from('drifted')); // Button new — identical
      mockS3Download(Buffer.from('modal-base'));
      mockS3Download(Buffer.from('modal-new'));
      diffPngMock.mockReturnValue(Buffer.from('diff'));

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
  });
});
