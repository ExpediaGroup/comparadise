/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  manifestGenerate,
  type ManifestGenerateDeps
} from '../src/manifest-generate';

const execMock = mock<any>(() => Promise.resolve(0));
const globMock = mock<any>();
const getInputMock = mock<any>();
const getMultilineInputMock = mock<any>();
const infoMock = mock<any>();
const setFailedMock = mock<any>();
const putObjectMock = mock<any>();
const getObjectMock = mock<any>();
const hashFileMock = mock<any>();
const readImageFileMock = mock<any>();
const resizeImageIfNeededMock = mock<any>();

function makeDeps(
  overrides: Partial<ManifestGenerateDeps> = {}
): ManifestGenerateDeps {
  return {
    exec: execMock,
    glob: globMock,
    getInput: getInputMock,
    getMultilineInput: getMultilineInputMock,
    info: infoMock,
    setFailed: setFailedMock,
    putObject: putObjectMock,
    getObject: getObjectMock,
    hashFile: hashFileMock,
    readImageFile: readImageFileMock,
    resizeImageIfNeeded: resizeImageIfNeededMock,
    ...overrides
  };
}

function setupInputs(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    'bucket-name': 'test-bucket',
    'commit-hash': 'abc123',
    'head-sha': '',
    'screenshots-directory': 'screenshots',
    'resize-width': '',
    'resize-height': '',
    'package-paths': ''
  };
  const inputs = { ...defaults, ...overrides };
  getInputMock.mockImplementation((name: string) => inputs[name] ?? '');
  getMultilineInputMock.mockImplementation((name: string) => {
    if (name === 'visual-test-command') return ['npm run test:visual'];
    return [];
  });
}

describe('manifestGenerate', () => {
  beforeEach(() => {
    execMock.mockReset().mockResolvedValue(0);
    globMock.mockReset();
    getInputMock.mockReset();
    getMultilineInputMock.mockReset();
    infoMock.mockReset();
    setFailedMock.mockReset();
    putObjectMock.mockReset();
    getObjectMock.mockReset();
    hashFileMock.mockReset();
    readImageFileMock.mockReset();
    resizeImageIfNeededMock.mockReset();

    resizeImageIfNeededMock.mockImplementation((buf: Buffer) =>
      Promise.resolve(buf)
    );
  });

  it('runs visual test commands', async () => {
    setupInputs();
    globMock.mockResolvedValue([]);
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );

    await manifestGenerate(makeDeps());

    expect(execMock).toHaveBeenCalledWith('npm run test:visual', [], {
      ignoreReturnCode: true
    });
  });

  it('fails when visual test command exits non-zero', async () => {
    setupInputs();
    execMock.mockResolvedValue(1);

    await manifestGenerate(makeDeps());

    expect(setFailedMock).toHaveBeenCalledWith(
      expect.stringContaining('Visual test command failed')
    );
  });

  it('builds manifest by hashing all png files in screenshots directory', async () => {
    setupInputs();
    globMock.mockResolvedValue([
      'screenshots/Button/new.png',
      'screenshots/Modal/new.png'
    ]);
    hashFileMock.mockResolvedValueOnce('hash1').mockResolvedValueOnce('hash2');
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );
    putObjectMock.mockResolvedValue({});
    readImageFileMock.mockResolvedValue(Buffer.from('fake-image'));

    await manifestGenerate(makeDeps());

    expect(hashFileMock).toHaveBeenCalledWith('screenshots/Button/new.png');
    expect(hashFileMock).toHaveBeenCalledWith('screenshots/Modal/new.png');
  });

  it('uploads manifest to S3 with correct key', async () => {
    setupInputs();
    globMock.mockResolvedValue(['screenshots/Button/new.png']);
    hashFileMock.mockResolvedValue('hash1');
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );
    putObjectMock.mockResolvedValue({});
    readImageFileMock.mockResolvedValue(Buffer.from('fake-image'));

    await manifestGenerate(makeDeps());

    expect(putObjectMock).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'manifests/abc123.json',
      Body: JSON.stringify({ 'Button/new.png': 'hash1' }),
      ContentType: 'application/json'
    });
  });

  it('uploads only changed images when HEAD manifest exists', async () => {
    setupInputs({ 'head-sha': 'base999' });
    globMock.mockResolvedValue([
      'screenshots/Button/new.png',
      'screenshots/Modal/new.png'
    ]);
    hashFileMock
      .mockResolvedValueOnce('hash1')
      .mockResolvedValueOnce('newHash2');

    const headManifest = {
      'Button/new.png': 'hash1',
      'Modal/new.png': 'oldHash2'
    };
    getObjectMock.mockResolvedValue({
      Body: {
        transformToString: () => Promise.resolve(JSON.stringify(headManifest))
      }
    });
    putObjectMock.mockResolvedValue({});
    readImageFileMock.mockResolvedValue(Buffer.from('modal-image'));

    await manifestGenerate(makeDeps());

    const uploadCalls = putObjectMock.mock.calls.filter((call: any) =>
      call[0].Key?.startsWith('new-images/')
    ) as any[];
    expect(uploadCalls).toHaveLength(1);
    expect(uploadCalls[0]![0].Key).toBe('new-images/abc123/Modal/new.png');
  });

  it('uploads all images when no HEAD manifest exists', async () => {
    setupInputs();
    globMock.mockResolvedValue([
      'screenshots/Button/new.png',
      'screenshots/Modal/new.png'
    ]);
    hashFileMock.mockResolvedValueOnce('hash1').mockResolvedValueOnce('hash2');
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );
    putObjectMock.mockResolvedValue({});
    readImageFileMock.mockResolvedValue(Buffer.from('fake-image'));

    await manifestGenerate(makeDeps());

    const uploadCalls = putObjectMock.mock.calls.filter((call: any) =>
      call[0].Key?.startsWith('new-images/')
    );
    expect(uploadCalls).toHaveLength(2);
  });

  it('uploads original full-size images when resize is enabled', async () => {
    setupInputs({ 'resize-width': '800' });
    globMock.mockResolvedValue(['screenshots/Button/new.png']);
    hashFileMock.mockResolvedValue('hash1');
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );
    putObjectMock.mockResolvedValue({});

    const originalBuffer = Buffer.from('full-size-image');
    const resizedBuffer = Buffer.from('resized-image');
    readImageFileMock.mockResolvedValue(originalBuffer);
    resizeImageIfNeededMock.mockResolvedValue(resizedBuffer);

    await manifestGenerate(makeDeps());

    const newImageCalls = putObjectMock.mock.calls.filter((call: any) =>
      call[0].Key?.startsWith('new-images/')
    ) as any[];
    const originalCalls = putObjectMock.mock.calls.filter((call: any) =>
      call[0].Key?.startsWith('original-new-images/')
    ) as any[];

    expect(newImageCalls).toHaveLength(1);
    expect(newImageCalls[0]![0].Body).toBe(resizedBuffer);
    expect(originalCalls).toHaveLength(1);
    expect(originalCalls[0]![0].Body).toBe(originalBuffer);
  });

  it('does not upload originals when resize is not enabled', async () => {
    setupInputs();
    globMock.mockResolvedValue(['screenshots/Button/new.png']);
    hashFileMock.mockResolvedValue('hash1');
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );
    putObjectMock.mockResolvedValue({});
    readImageFileMock.mockResolvedValue(Buffer.from('fake-image'));

    await manifestGenerate(makeDeps());

    const originalCalls = putObjectMock.mock.calls.filter((call: any) =>
      call[0].Key?.startsWith('original-new-images/')
    );
    expect(originalCalls).toHaveLength(0);
  });

  it('uses package-paths to prefix manifest keys', async () => {
    setupInputs({ 'package-paths': 'pkg-a,pkg-b' });
    globMock.mockResolvedValue([
      'screenshots/pkg-a/Button/new.png',
      'screenshots/pkg-b/Modal/new.png'
    ]);
    hashFileMock.mockResolvedValueOnce('hashA').mockResolvedValueOnce('hashB');
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );
    putObjectMock.mockResolvedValue({});
    readImageFileMock.mockResolvedValue(Buffer.from('fake-image'));

    await manifestGenerate(makeDeps());

    const manifestCall = putObjectMock.mock.calls.find((call: any) =>
      call[0].Key?.startsWith('manifests/')
    ) as any;
    const manifest = JSON.parse(manifestCall![0].Body);
    expect(manifest).toEqual({
      'pkg-a/Button/new.png': 'hashA',
      'pkg-b/Modal/new.png': 'hashB'
    });
  });
});
