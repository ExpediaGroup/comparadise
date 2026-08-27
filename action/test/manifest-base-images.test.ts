/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  baseImageKey,
  legacyBaseImageKey,
  makeBaseImageReader
} from '../src/manifest-base-images';

const getObjectMock = mock<any>();
const infoMock = mock<any>();

function makeReader() {
  return makeBaseImageReader({
    s3: { getObject: getObjectMock } as any,
    core: { info: infoMock } as any
  });
}

function mockDownload(body: Buffer) {
  getObjectMock.mockResolvedValueOnce({
    Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(body)) }
  });
}

function noSuchKey() {
  const error = new Error('The specified key does not exist.');
  error.name = 'NoSuchKey';
  return error;
}

const bucket = 'test-bucket';

describe('baseImageKey', () => {
  it('names the object after the hash the manifest records', () => {
    expect(baseImageKey('components/Button', 'abc123')).toBe(
      'base-images/components/Button/abc123.png'
    );
  });

  it('keeps the legacy key stable for the pr/merge workflows', () => {
    expect(legacyBaseImageKey('components/Button')).toBe(
      'base-images/components/Button/base.png'
    );
  });
});

describe('makeBaseImageReader', () => {
  beforeEach(() => {
    getObjectMock.mockReset();
    infoMock.mockReset();
  });

  it('resolves the image named for the requested hash', async () => {
    mockDownload(Buffer.from('by-hash'));

    const resolved = await makeReader().getBaseImage(
      bucket,
      'components/Button',
      'abc123'
    );

    expect(resolved).toEqual({
      buffer: Buffer.from('by-hash'),
      key: 'base-images/components/Button/abc123.png',
      resolvedBy: 'hash'
    });
    expect(infoMock).not.toHaveBeenCalled();
  });

  it('falls back to the legacy key when the hash-named object is absent', async () => {
    getObjectMock.mockRejectedValueOnce(noSuchKey());
    mockDownload(Buffer.from('legacy'));

    const resolved = await makeReader().getBaseImage(
      bucket,
      'components/Button',
      'abc123'
    );

    expect(resolved).toEqual({
      buffer: Buffer.from('legacy'),
      key: 'base-images/components/Button/base.png',
      resolvedBy: 'legacy'
    });
    expect(infoMock).toHaveBeenCalledWith(
      'No content-addressed base image at base-images/components/Button/abc123.png — falling back to base-images/components/Button/base.png.'
    );
  });

  it('reads the legacy key directly when no hash is known', async () => {
    mockDownload(Buffer.from('legacy'));

    const resolved = await makeReader().getBaseImage(
      bucket,
      'components/Button',
      null
    );

    expect(resolved.resolvedBy).toBe('legacy');
    expect(getObjectMock).toHaveBeenCalledTimes(1);
    expect(getObjectMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: 'base-images/components/Button/base.png'
    });
  });

  it('propagates errors other than a missing key', async () => {
    getObjectMock.mockRejectedValueOnce(new Error('AccessDenied'));

    await expect(
      makeReader().getBaseImage(bucket, 'components/Button', 'abc123')
    ).rejects.toThrow('AccessDenied');
    expect(getObjectMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a missing legacy image rather than masking it', async () => {
    getObjectMock.mockRejectedValueOnce(noSuchKey());
    getObjectMock.mockRejectedValueOnce(noSuchKey());

    await expect(
      makeReader().getBaseImage(bucket, 'components/Button', 'abc123')
    ).rejects.toThrow('The specified key does not exist.');
  });
});
