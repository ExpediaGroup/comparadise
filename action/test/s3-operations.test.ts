import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import path from 'path';

// Must be called before any imports of the mocked modules

const getInputMock = mock();
const infoMock = mock();
mock.module('@actions/core', () => ({
  getInput: getInputMock,
  getBooleanInput: mock(),
  getMultilineInput: mock(),
  setFailed: mock(),
  warning: mock(),
  info: infoMock
}));

const listObjectsMock = mock();
const getObjectMock = mock();
const putObjectMock = mock();
mock.module('../src/s3-client', () => ({
  listObjects: listObjectsMock,
  getObject: getObjectMock,
  putObject: putObjectMock
}));

const globMock = mock();
mock.module('glob', () => ({
  glob: globMock
}));

const createWriteStreamMock = mock();
const mkdirMock = mock();
const readFileMock = mock();
mock.module('fs', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const actualFs = require('fs');
  return {
    ...actualFs,
    createWriteStream: createWriteStreamMock,
    promises: {
      mkdir: mkdirMock,
      readFile: readFileMock
    }
  };
});

const jimpImageMock = {
  cover: mock(),
  resize: mock(),
  getBuffer: mock()
};
const jimpReadMock = mock();
mock.module('jimp', () => ({
  Jimp: { read: jimpReadMock }
}));

// A Readable subclass whose pipe() immediately triggers 'finish' on the destination
class MockReadable extends Readable {
  _read() {}
  pipe<T extends NodeJS.WritableStream>(dest: T): T {
    process.nextTick(() => (dest as unknown as EventEmitter).emit('finish'));
    return dest;
  }
}

async function getS3Operations() {
  return import('../src/s3-operations');
}

let inputMap: Record<string, string> = {};

const defaultInputMap: Record<string, string> = {
  'bucket-name': 'test-bucket',
  'screenshots-directory': 'path/to/screenshots',
  'package-paths': '',
  'resize-width': '',
  'resize-height': ''
};

describe('s3-operations', () => {
  beforeEach(() => {
    inputMap = { ...defaultInputMap };
    getInputMock.mockImplementation((name: string) => inputMap[name] ?? '');

    listObjectsMock.mockResolvedValue({ Contents: [] });
    getObjectMock.mockResolvedValue({ Body: null });
    putObjectMock.mockResolvedValue({});
    globMock.mockResolvedValue([]);
    mkdirMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(Buffer.from('image-data'));
    createWriteStreamMock.mockReturnValue(new EventEmitter());

    jimpReadMock.mockResolvedValue(jimpImageMock);
    jimpImageMock.cover.mockReturnValue(jimpImageMock);
    jimpImageMock.resize.mockReturnValue(jimpImageMock);
    jimpImageMock.getBuffer.mockResolvedValue(Buffer.from('resized-image'));
  });

  afterEach(() => {
    mock.clearAllMocks();
  });

  describe('downloadBaseImages', () => {
    it('should create screenshots directory and skip download when prefix does not exist', async () => {
      listObjectsMock.mockResolvedValue({ Contents: [] });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages();

      expect(mkdirMock).toHaveBeenCalledWith('path/to/screenshots', {
        recursive: true
      });
      expect(getObjectMock).not.toHaveBeenCalled();
    });

    it('should create screenshots directory and skip download when S3 check throws', async () => {
      listObjectsMock.mockRejectedValue(new Error('S3 error'));

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages();

      expect(mkdirMock).toHaveBeenCalledWith('path/to/screenshots', {
        recursive: true
      });
      expect(getObjectMock).not.toHaveBeenCalled();
    });

    it('should download only base.png files from S3 when prefix exists', async () => {
      // checkS3PrefixExists → prefix exists
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component/base.png' }]
      });
      // downloadS3Directory → list all objects (new.png should be filtered out)
      listObjectsMock.mockResolvedValueOnce({
        Contents: [
          { Key: 'base-images/component/base.png' },
          { Key: 'base-images/component/new.png' }
        ]
      });
      getObjectMock.mockResolvedValue({ Body: new MockReadable() });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages();

      expect(getObjectMock).toHaveBeenCalledTimes(1);
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'base-images/component/base.png'
      });
      expect(createWriteStreamMock).toHaveBeenCalledTimes(1);
    });

    it('should skip writing file when S3 body is not a Readable', async () => {
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component/base.png' }]
      });
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/component/base.png' }]
      });
      getObjectMock.mockResolvedValue({ Body: 'not-a-readable' });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages();

      expect(createWriteStreamMock).not.toHaveBeenCalled();
    });

    it('should download from each package path subdirectory when package-paths is set', async () => {
      inputMap['package-paths'] = 'pkg1,pkg2';

      // checkS3PrefixExists
      listObjectsMock.mockResolvedValueOnce({
        Contents: [{ Key: 'base-images/something' }]
      });
      // downloadS3Directory for pkg1
      listObjectsMock.mockResolvedValueOnce({ Contents: [] });
      // downloadS3Directory for pkg2
      listObjectsMock.mockResolvedValueOnce({ Contents: [] });

      const { downloadBaseImages } = await getS3Operations();
      await downloadBaseImages();

      expect(listObjectsMock).toHaveBeenCalledTimes(3);
      expect(listObjectsMock).toHaveBeenCalledWith(
        expect.objectContaining({ Prefix: 'base-images/pkg1/' })
      );
      expect(listObjectsMock).toHaveBeenCalledWith(
        expect.objectContaining({ Prefix: 'base-images/pkg2/' })
      );
    });
  });

  describe('uploadAllImages', () => {
    it('should upload all files from directories that contain a new.png', async () => {
      globMock.mockResolvedValue([
        'component/base.png',
        'component/new.png',
        'component/diff.png'
      ]);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(putObjectMock).toHaveBeenCalledTimes(3);
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: path.join('new-images/abc123/', 'component/base.png')
        })
      );
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: path.join('new-images/abc123/', 'component/new.png')
        })
      );
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: path.join('new-images/abc123/', 'component/diff.png')
        })
      );
    });

    it('should exclude files from directories that have no new.png', async () => {
      globMock.mockResolvedValue([
        'failing/base.png',
        'failing/new.png',
        'passing/base.png' // no new.png in passing/ → excluded
      ]);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(putObjectMock).toHaveBeenCalledTimes(2);
      expect(putObjectMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          Key: expect.stringContaining('passing/base.png')
        })
      );
    });

    it('should not upload anything when no new.png files exist', async () => {
      globMock.mockResolvedValue(['component/base.png', 'component/diff.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(putObjectMock).not.toHaveBeenCalled();
    });

    it('should glob and upload from each package path subdirectory', async () => {
      inputMap['package-paths'] = 'pkg1,pkg2';
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(globMock).toHaveBeenCalledTimes(2);
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: expect.stringContaining('pkg1')
        })
      );
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: expect.stringContaining('pkg2')
        })
      );
    });

    it('should upload the original buffer when no resize inputs are set', async () => {
      const originalBuffer = Buffer.from('original-image');
      globMock.mockResolvedValue(['component/new.png']);
      readFileMock.mockResolvedValue(originalBuffer);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(jimpReadMock).not.toHaveBeenCalled();
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ Body: originalBuffer })
      );
    });

    it('should resize with width only when resize-width is set', async () => {
      inputMap['resize-width'] = '200';
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(jimpReadMock).toHaveBeenCalled();
      expect(jimpImageMock.resize).toHaveBeenCalledWith({ w: 200 });
      expect(jimpImageMock.cover).not.toHaveBeenCalled();
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ Body: Buffer.from('resized-image') })
      );
    });

    it('should resize with height only when resize-height is set', async () => {
      inputMap['resize-height'] = '150';
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(jimpImageMock.resize).toHaveBeenCalledWith({ h: 150 });
      expect(jimpImageMock.cover).not.toHaveBeenCalled();
    });

    it('should resize using cover when both resize-width and resize-height are set', async () => {
      inputMap['resize-width'] = '200';
      inputMap['resize-height'] = '150';
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadAllImages } = await getS3Operations();
      await uploadAllImages('abc123');

      expect(jimpImageMock.cover).toHaveBeenCalledWith({ w: 200, h: 150 });
      expect(jimpImageMock.resize).not.toHaveBeenCalled();
    });
  });

  describe('uploadOriginalNewImages', () => {
    it('should return early when no resize inputs are set', async () => {
      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123');

      expect(globMock).not.toHaveBeenCalled();
      expect(putObjectMock).not.toHaveBeenCalled();
    });

    it('should upload original new.png files (without resize) when resize-width is set', async () => {
      inputMap['resize-width'] = '200';
      const originalBuffer = Buffer.from('original-image');
      globMock.mockResolvedValue(['component/new.png']);
      readFileMock.mockResolvedValue(originalBuffer);

      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123');

      expect(jimpReadMock).not.toHaveBeenCalled();
      expect(putObjectMock).toHaveBeenCalledTimes(1);
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: path.join('original-new-images/abc123/', 'component/new.png'),
        Body: originalBuffer
      });
    });

    it('should upload original new.png files when resize-height is set', async () => {
      inputMap['resize-height'] = '150';
      globMock.mockResolvedValue(['component/new.png']);

      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123');

      expect(putObjectMock).toHaveBeenCalledTimes(1);
    });

    it('should upload from each package path subdirectory', async () => {
      inputMap['resize-width'] = '200';
      inputMap['package-paths'] = 'pkg1,pkg2';
      globMock.mockResolvedValue([]);

      const { uploadOriginalNewImages } = await getS3Operations();
      await uploadOriginalNewImages('abc123');

      expect(globMock).toHaveBeenCalledTimes(2);
      expect(globMock).toHaveBeenCalledWith(
        '**/new.png',
        expect.objectContaining({
          cwd: path.join('path/to/screenshots', 'pkg1')
        })
      );
      expect(globMock).toHaveBeenCalledWith(
        '**/new.png',
        expect.objectContaining({
          cwd: path.join('path/to/screenshots', 'pkg2')
        })
      );
    });
  });

  describe('uploadBaseImages', () => {
    it('should upload each new image as a base image with the correct S3 key', async () => {
      const { uploadBaseImages } = await getS3Operations();
      await uploadBaseImages(['path/to/screenshots/component/new.png']);

      expect(putObjectMock).toHaveBeenCalledTimes(1);
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: path.join('base-images', 'component', 'base.png'),
        Body: expect.any(Buffer)
      });
    });

    it('should upload multiple base images', async () => {
      const { uploadBaseImages } = await getS3Operations();
      await uploadBaseImages([
        'path/to/screenshots/component1/new.png',
        'path/to/screenshots/component2/new.png'
      ]);

      expect(putObjectMock).toHaveBeenCalledTimes(2);
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: path.join('base-images', 'component1', 'base.png')
        })
      );
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: path.join('base-images', 'component2', 'base.png')
        })
      );
    });

    it('should resize the image when resize-width is set', async () => {
      inputMap['resize-width'] = '300';

      const { uploadBaseImages } = await getS3Operations();
      await uploadBaseImages(['path/to/screenshots/component/new.png']);

      expect(jimpReadMock).toHaveBeenCalled();
      expect(jimpImageMock.resize).toHaveBeenCalledWith({ w: 300 });
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ Body: Buffer.from('resized-image') })
      );
    });
  });
});
