/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, afterEach } from 'bun:test';
import { makeManifestS3 } from '../src/manifest-s3';

const putObjectMock = mock<any>();
const getObjectMock = mock<any>();
const listAllObjectsMock = mock<any>();

const s3Mock = {
  putObject: putObjectMock,
  getObject: getObjectMock,
  listAllObjects: listAllObjectsMock
} as any;

const {
  putManifest,
  getManifest,
  putChangeset,
  getChangeset,
  squashPrManifest
} = makeManifestS3(s3Mock);

const bucket = 'test-bucket';
const sha = 'abc123def456';

describe('putManifest', () => {
  afterEach(() => putObjectMock.mockClear());

  it('uploads manifest JSON to the correct S3 key', async () => {
    const manifest = {
      'components/Button/screenshot.png': 'd41d8cd98f00b204e9800998ecf8427e',
      'pages/Home/screenshot.png': '098f6bcd4621d373cade4e832627b4f6'
    };

    await putManifest(bucket, sha, manifest);

    expect(putObjectMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: `manifests/${sha}.json`,
      Body: JSON.stringify(manifest),
      ContentType: 'application/json'
    });
  });
});

describe('getManifest', () => {
  afterEach(() => getObjectMock.mockClear());

  it('fetches and parses manifest JSON from S3', async () => {
    const manifest = {
      'components/Button/screenshot.png': 'd41d8cd98f00b204e9800998ecf8427e'
    };
    getObjectMock.mockResolvedValueOnce({
      Body: {
        transformToString: () => Promise.resolve(JSON.stringify(manifest))
      }
    });

    const result = await getManifest(bucket, sha);

    expect(getObjectMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: `manifests/${sha}.json`
    });
    expect(result).toEqual(manifest);
  });

  it('returns null when the manifest does not exist', async () => {
    const error = new Error('NoSuchKey');
    error.name = 'NoSuchKey';
    getObjectMock.mockRejectedValueOnce(error);

    const result = await getManifest(bucket, sha);

    expect(result).toBeNull();
  });
});

describe('putChangeset', () => {
  afterEach(() => putObjectMock.mockClear());

  it('uploads changeset JSON to the correct S3 key', async () => {
    const changeset = {
      'components/Button/screenshot.png': 'a3c2f8d1b4e6a9c7d2f0e1b3a5c7d9f1',
      'components/Removed/screenshot.png': null
    };

    await putChangeset(bucket, sha, changeset);

    expect(putObjectMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: `changesets/${sha}.json`,
      Body: JSON.stringify(changeset),
      ContentType: 'application/json'
    });
  });
});

describe('getChangeset', () => {
  afterEach(() => getObjectMock.mockClear());

  it('fetches and parses changeset JSON from S3', async () => {
    const changeset = {
      'components/Button/screenshot.png': 'newhash',
      'deleted/screenshot.png': null
    };
    getObjectMock.mockResolvedValueOnce({
      Body: {
        transformToString: () => Promise.resolve(JSON.stringify(changeset))
      }
    });

    const result = await getChangeset(bucket, sha);

    expect(getObjectMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: `changesets/${sha}.json`
    });
    expect(result).toEqual(changeset);
  });

  it('returns null when the changeset does not exist', async () => {
    const error = new Error('NoSuchKey');
    error.name = 'NoSuchKey';
    getObjectMock.mockRejectedValueOnce(error);

    const result = await getChangeset(bucket, sha);

    expect(result).toBeNull();
  });
});

describe('squashPrManifest', () => {
  afterEach(() => {
    putObjectMock.mockClear();
    getObjectMock.mockClear();
    listAllObjectsMock.mockClear();
  });

  const manifestPart = (manifest: Record<string, string>) => ({
    Body: {
      transformToString: () => Promise.resolve(JSON.stringify(manifest))
    }
  });

  it('merges per-package manifests and writes the combined manifest', async () => {
    listAllObjectsMock.mockResolvedValueOnce([
      { Key: `manifests/${sha}/packages/ui.json` },
      { Key: `manifests/${sha}/packages/core.json` }
    ]);
    getObjectMock
      .mockResolvedValueOnce(manifestPart({ 'packages/ui/Button': 'hash-ui' }))
      .mockResolvedValueOnce(
        manifestPart({ 'packages/core/Modal': 'hash-core' })
      );

    const result = await squashPrManifest(bucket, sha);

    const merged = {
      'packages/ui/Button': 'hash-ui',
      'packages/core/Modal': 'hash-core'
    };
    expect(listAllObjectsMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Prefix: `manifests/${sha}/`
    });
    expect(result).toEqual(merged);
    expect(putObjectMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: `manifests/${sha}.json`,
      Body: JSON.stringify(merged),
      ContentType: 'application/json'
    });
  });

  it('returns null and writes nothing when no per-package manifests exist', async () => {
    listAllObjectsMock.mockResolvedValueOnce([]);

    const result = await squashPrManifest(bucket, sha);

    expect(result).toBeNull();
    expect(getObjectMock).not.toHaveBeenCalled();
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('throws and writes nothing when two per-package manifests share a key', async () => {
    listAllObjectsMock.mockResolvedValueOnce([
      { Key: `manifests/${sha}/packages.json` },
      { Key: `manifests/${sha}/packages/ui.json` }
    ]);
    getObjectMock
      .mockResolvedValueOnce(manifestPart({ 'packages/ui/Button': 'hash-a' }))
      .mockResolvedValueOnce(manifestPart({ 'packages/ui/Button': 'hash-b' }));

    await expect(squashPrManifest(bucket, sha)).rejects.toThrow(
      /Duplicate manifest key "packages\/ui\/Button"/
    );
    expect(putObjectMock).not.toHaveBeenCalled();
  });
});
