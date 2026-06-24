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
    diffPngMock.mockReturnValue(diffBuffer);

    await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

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

    await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

    expect(getObjectMock).not.toHaveBeenCalled();
    expect(putObjectMock).not.toHaveBeenCalled();
    expect(diffPngMock).not.toHaveBeenCalled();
  });

  it('skips deleted entries — no images to upload', async () => {
    const prOwns: PrOwnsEntry[] = [
      { path: 'components/Removed', type: 'deleted' }
    ];

    await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

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

    const buf = Buffer.from('img');
    mockS3Download(buf); // Button base
    mockS3Download(buf); // Button new
    mockS3Download(buf); // Modal base
    mockS3Download(buf); // Modal new
    diffPngMock.mockReturnValue(Buffer.from('diff'));

    await generateDiffs({ bucket, prSha, prOwns }, makeDeps());

    const putCalls = putObjectMock.mock.calls;
    expect(putCalls).toHaveLength(4); // 2 base + 2 diff uploads
  });
});
