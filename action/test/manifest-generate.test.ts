/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import { context as githubContext } from '@actions/github';
import { manifestGenerate } from '../src/manifest-generate';
import { hashString } from '../src/hash';
import type { Dependencies } from '../src/dependencies';

const execMock = mock<any>(() => Promise.resolve(0));
const globMock = mock<any>();
const putObjectMock = mock<any>();
const getObjectMock = mock<any>();
const hashFileMock = mock<any>();
const readFileMock = mock<any>();
const jimpReadMock = mock<any>();
const infoMock = mock<any>();
const setFailedMock = mock<any>();
const getBranchMock = mock<any>();

function makeDeps(): Dependencies {
  return {
    core: {
      setFailed: setFailedMock,
      warning: mock(),
      info: infoMock
    },
    octokit: {
      rest: { repos: { getBranch: getBranchMock } }
    } as unknown as Dependencies['octokit'],
    exec: execMock,
    glob: globMock as unknown as Dependencies['glob'],
    jimp: { read: jimpReadMock },
    s3: {
      putObject: putObjectMock,
      getObject: getObjectMock
    } as unknown as Dependencies['s3'],
    fs: {
      unlinkSync: mock(),
      createWriteStream: mock(),
      mkdir: mock(),
      readFile: readFileMock
    },
    hashFile: hashFileMock,
    context: {
      runAttempt: 1,
      runId: 1,
      serverUrl: 'https://github.com',
      repo: { owner: 'test', repo: 'test' },
      issue: { number: 1 }
    }
  };
}

const setEnv = (map: Record<string, string | undefined>) => {
  for (const [key, value] of Object.entries(map)) {
    const envKey = `INPUT_${key.replace(/ /g, '_').toUpperCase()}`;
    if (value === undefined) {
      delete process.env[envKey];
    } else {
      process.env[envKey] = value;
    }
  }
};

const clearEnv = (...keys: string[]) => {
  for (const key of keys) {
    delete process.env[`INPUT_${key.replace(/ /g, '_').toUpperCase()}`];
  }
};

const defaultInputs: Record<string, string> = {
  'bucket-name': 'test-bucket',
  'commit-hash': 'abc123',
  'screenshots-directory': 'screenshots',
  'resize-width': '',
  'resize-height': '',
  'visual-test-command': 'npm run test:visual'
};

describe('manifestGenerate', () => {
  beforeEach(() => {
    execMock.mockReset().mockResolvedValue(0);
    globMock.mockReset();
    putObjectMock.mockReset().mockResolvedValue({});
    getObjectMock.mockReset();
    hashFileMock.mockReset();
    readFileMock.mockReset();
    jimpReadMock.mockReset();
    infoMock.mockReset();
    setFailedMock.mockReset();
    getBranchMock.mockReset();
    githubContext.payload = {};

    setEnv(defaultInputs);
  });

  afterEach(() => {
    githubContext.payload = {};
    clearEnv(
      'bucket-name',
      'commit-hash',
      'screenshots-directory',
      'resize-width',
      'resize-height',
      'visual-test-command',
      'package-paths'
    );
  });

  it('runs visual test commands', async () => {
    globMock.mockResolvedValue([]);

    await manifestGenerate(makeDeps());

    expect(execMock).toHaveBeenCalledWith('npm run test:visual', [], {
      ignoreReturnCode: true
    });
  });

  it('fails when visual test command exits non-zero', async () => {
    execMock.mockResolvedValue(1);

    await manifestGenerate(makeDeps());

    expect(setFailedMock).toHaveBeenCalledWith(
      expect.stringContaining('Visual test command failed')
    );
  });

  it('fails when commit-hash is not supplied', async () => {
    clearEnv('commit-hash');
    globMock.mockResolvedValue([]);

    // getInput('commit-hash', { required: true }) throws before any S3 write,
    // so a missing hash can never produce a malformed `manifests/.json` key.
    await expect(manifestGenerate(makeDeps())).rejects.toThrow(/commit-hash/i);
  });

  it('builds manifest by hashing new.png files keyed by containing directory', async () => {
    globMock.mockResolvedValue([
      'screenshots/Button/new.png',
      'screenshots/Modal/new.png'
    ]);
    hashFileMock.mockResolvedValueOnce('hash1').mockResolvedValueOnce('hash2');
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );
    readFileMock.mockResolvedValue(Buffer.from('fake-image'));

    await manifestGenerate(makeDeps());

    expect(hashFileMock).toHaveBeenCalledWith('screenshots/Button/new.png');
    expect(hashFileMock).toHaveBeenCalledWith('screenshots/Modal/new.png');
  });

  it('uploads manifest to S3 with correct key', async () => {
    globMock.mockResolvedValue(['screenshots/Button/new.png']);
    hashFileMock.mockResolvedValue('hash1');
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );
    readFileMock.mockResolvedValue(Buffer.from('fake-image'));

    await manifestGenerate(makeDeps());

    expect(putObjectMock).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'manifests/abc123.json',
      Body: JSON.stringify({ Button: 'hash1' }),
      ContentType: 'application/json'
    });
  });

  it('uploads only changed images when HEAD manifest exists', async () => {
    githubContext.payload = {
      pull_request: { number: 1, base: { ref: 'main' } }
    };
    getBranchMock.mockResolvedValue({ data: { commit: { sha: 'base999' } } });
    globMock.mockResolvedValue([
      'screenshots/Button/new.png',
      'screenshots/Modal/new.png'
    ]);
    hashFileMock
      .mockResolvedValueOnce('hash1')
      .mockResolvedValueOnce('newHash2');

    const headManifest = {
      Button: 'hash1',
      Modal: 'oldHash2'
    };
    getObjectMock.mockResolvedValue({
      Body: {
        transformToString: () => Promise.resolve(JSON.stringify(headManifest))
      }
    });
    readFileMock.mockResolvedValue(Buffer.from('modal-image'));

    await manifestGenerate(makeDeps());

    const uploadCalls = putObjectMock.mock.calls.filter((call: any) =>
      call[0].Key?.startsWith('new-images/')
    ) as any[];
    expect(uploadCalls).toHaveLength(1);
    expect(uploadCalls[0]![0].Key).toBe('new-images/abc123/Modal/new.png');
  });

  it('uploads all images when no HEAD manifest exists', async () => {
    globMock.mockResolvedValue([
      'screenshots/Button/new.png',
      'screenshots/Modal/new.png'
    ]);
    hashFileMock.mockResolvedValueOnce('hash1').mockResolvedValueOnce('hash2');
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );
    readFileMock.mockResolvedValue(Buffer.from('fake-image'));

    await manifestGenerate(makeDeps());

    const uploadCalls = putObjectMock.mock.calls.filter((call: any) =>
      call[0].Key?.startsWith('new-images/')
    );
    expect(uploadCalls).toHaveLength(2);
  });

  it('uploads resized image to new-images/ and does not write original-new-images/ when resize is enabled', async () => {
    setEnv({ 'resize-width': '800' });
    globMock.mockResolvedValue(['screenshots/Button/new.png']);
    hashFileMock.mockResolvedValue('hash1');
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );

    const originalBuffer = Buffer.from('full-size-image');
    const resizedBuffer = Buffer.from('resized-image');
    readFileMock.mockResolvedValue(originalBuffer);
    jimpReadMock.mockResolvedValue({
      width: 1200,
      height: 900,
      resize: mock().mockReturnThis(),
      getBuffer: mock().mockResolvedValue(resizedBuffer)
    });

    await manifestGenerate(makeDeps());

    const newImageCalls = putObjectMock.mock.calls.filter((call: any) =>
      call[0].Key?.startsWith('new-images/')
    ) as any[];
    const originalCalls = putObjectMock.mock.calls.filter((call: any) =>
      call[0].Key?.startsWith('original-new-images/')
    );

    expect(newImageCalls).toHaveLength(1);
    expect(newImageCalls[0]![0].Body).toEqual(resizedBuffer);
    expect(originalCalls).toHaveLength(0);
  });

  it('does not upload originals when resize is not enabled', async () => {
    globMock.mockResolvedValue(['screenshots/Button/new.png']);
    hashFileMock.mockResolvedValue('hash1');
    getObjectMock.mockRejectedValue(
      Object.assign(new Error(), { name: 'NoSuchKey' })
    );
    readFileMock.mockResolvedValue(Buffer.from('fake-image'));

    await manifestGenerate(makeDeps());

    const originalCalls = putObjectMock.mock.calls.filter((call: any) =>
      call[0].Key?.startsWith('original-new-images/')
    );
    expect(originalCalls).toHaveLength(0);
  });

  describe('monorepo (package-paths set)', () => {
    it('keys entries by their on-disk relative path and names the manifest by chunk-id', async () => {
      setEnv({ 'package-paths': 'packages/ui' });
      globMock.mockResolvedValue(['screenshots/packages/ui/Button/new.png']);
      hashFileMock.mockResolvedValue('hash1');
      getObjectMock.mockRejectedValue(
        Object.assign(new Error(), { name: 'NoSuchKey' })
      );
      readFileMock.mockResolvedValue(Buffer.from('fake-image'));

      await manifestGenerate(makeDeps());

      const newImageCall = putObjectMock.mock.calls.find((call: any) =>
        call[0].Key?.startsWith('new-images/')
      ) as any[];
      expect(newImageCall![0].Key).toBe(
        'new-images/abc123/packages/ui/Button/new.png'
      );

      const manifestCall = putObjectMock.mock.calls.find((call: any) =>
        call[0].Key?.startsWith('manifests/')
      ) as any[];
      expect(manifestCall![0].Key).toBe(
        `manifests/abc123/${hashString('packages/ui')}.json`
      );
      expect(manifestCall![0].Body).toBe(
        JSON.stringify({ 'packages/ui/Button': 'hash1' })
      );
    });

    it('accepts multiple packages in a single job (a chunk) and writes one manifest', async () => {
      setEnv({ 'package-paths': 'packages/ui,packages/core' });
      globMock.mockResolvedValue([
        'screenshots/packages/ui/Button/new.png',
        'screenshots/packages/core/Widget/new.png'
      ]);
      hashFileMock
        .mockResolvedValueOnce('hashUi')
        .mockResolvedValueOnce('hashCore');
      getObjectMock.mockRejectedValue(
        Object.assign(new Error(), { name: 'NoSuchKey' })
      );
      readFileMock.mockResolvedValue(Buffer.from('fake-image'));

      await manifestGenerate(makeDeps());

      expect(setFailedMock).not.toHaveBeenCalled();

      const manifestCalls = putObjectMock.mock.calls.filter((call: any) =>
        call[0].Key?.startsWith('manifests/')
      ) as any[];
      expect(manifestCalls).toHaveLength(1);
      // chunk-id is order-independent: package-paths are sorted before hashing,
      // so the reversed input here still yields the sorted-order hash.
      expect(manifestCalls[0]![0].Key).toBe(
        `manifests/abc123/${hashString('packages/core,packages/ui')}.json`
      );
      expect(JSON.parse(manifestCalls[0]![0].Body)).toEqual({
        'packages/ui/Button': 'hashUi',
        'packages/core/Widget': 'hashCore'
      });

      const uploadedKeys = putObjectMock.mock.calls
        .filter((call: any) => call[0].Key?.startsWith('new-images/'))
        .map((call: any) => call[0].Key);
      expect(uploadedKeys).toContain(
        'new-images/abc123/packages/ui/Button/new.png'
      );
      expect(uploadedKeys).toContain(
        'new-images/abc123/packages/core/Widget/new.png'
      );
    });

    it('reads the local screenshot path as it exists on disk', async () => {
      setEnv({ 'package-paths': 'packages/ui' });
      globMock.mockResolvedValue(['screenshots/packages/ui/Button/new.png']);
      hashFileMock.mockResolvedValue('hash1');
      getObjectMock.mockRejectedValue(
        Object.assign(new Error(), { name: 'NoSuchKey' })
      );
      readFileMock.mockResolvedValue(Buffer.from('fake-image'));

      await manifestGenerate(makeDeps());

      expect(readFileMock).toHaveBeenCalledWith(
        'screenshots/packages/ui/Button/new.png'
      );
    });

    it('only uploads images whose hash differs from the HEAD manifest', async () => {
      setEnv({ 'package-paths': 'packages/ui' });
      githubContext.payload = {
        pull_request: { number: 1, base: { ref: 'main' } }
      };
      getBranchMock.mockResolvedValue({ data: { commit: { sha: 'base999' } } });
      globMock.mockResolvedValue([
        'screenshots/packages/ui/Button/new.png',
        'screenshots/packages/ui/Modal/new.png'
      ]);
      hashFileMock
        .mockResolvedValueOnce('hash1')
        .mockResolvedValueOnce('newHash2');
      getObjectMock.mockResolvedValue({
        Body: {
          transformToString: () =>
            Promise.resolve(
              JSON.stringify({
                'packages/ui/Button': 'hash1',
                'packages/ui/Modal': 'oldHash2'
              })
            )
        }
      });
      readFileMock.mockResolvedValue(Buffer.from('modal-image'));

      await manifestGenerate(makeDeps());

      const uploadCalls = putObjectMock.mock.calls.filter((call: any) =>
        call[0].Key?.startsWith('new-images/')
      ) as any[];
      expect(uploadCalls).toHaveLength(1);
      expect(uploadCalls[0]![0].Key).toBe(
        'new-images/abc123/packages/ui/Modal/new.png'
      );
    });
  });
});
