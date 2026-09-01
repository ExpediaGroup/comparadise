/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  cleanupOrphanedNewImages,
  type CleanupOrphanedNewImagesDeps
} from '../src/manifest-compare-cleanup';

const listAllObjectsMock = mock<any>();
const deleteObjectsMock = mock<any>();
const infoMock = mock<any>();

function makeDeps(): CleanupOrphanedNewImagesDeps {
  return {
    s3: {
      listAllObjects: listAllObjectsMock,
      deleteObjects: deleteObjectsMock
    } as any,
    core: { info: infoMock } as any
  };
}

const bucket = 'test-bucket';
const prSha = 'pr-sha-111';
const prefix = `new-images/${prSha}/`;

describe('cleanupOrphanedNewImages', () => {
  beforeEach(() => {
    listAllObjectsMock.mockReset();
    deleteObjectsMock.mockReset().mockResolvedValue({});
    infoMock.mockReset();
  });

  it('deletes files for paths outside the review set and keeps the rest', async () => {
    listAllObjectsMock.mockResolvedValue([
      { Key: `${prefix}packages/ui/Button/new.png` },
      { Key: `${prefix}packages/ui/Button/base.png` },
      { Key: `${prefix}packages/ui/Button/diff.png` },
      { Key: `${prefix}packages/ui/Modal/new.png` }
    ]);

    await cleanupOrphanedNewImages(
      bucket,
      prSha,
      ['packages/ui/Button'],
      makeDeps()
    );

    expect(deleteObjectsMock).toHaveBeenCalledTimes(1);
    expect(deleteObjectsMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Delete: {
        Objects: [{ Key: `${prefix}packages/ui/Modal/new.png` }]
      }
    });
  });

  it('deletes everything under the hash prefix when the review set is empty', async () => {
    listAllObjectsMock.mockResolvedValue([
      { Key: `${prefix}packages/ui/Button/new.png` },
      { Key: `${prefix}packages/ui/Modal/new.png` }
    ]);

    await cleanupOrphanedNewImages(bucket, prSha, [], makeDeps());

    expect(deleteObjectsMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Delete: {
        Objects: [
          { Key: `${prefix}packages/ui/Button/new.png` },
          { Key: `${prefix}packages/ui/Modal/new.png` }
        ]
      }
    });
  });

  it('does not call delete when every uploaded path is in the review set', async () => {
    listAllObjectsMock.mockResolvedValue([
      { Key: `${prefix}packages/ui/Button/new.png` }
    ]);

    await cleanupOrphanedNewImages(
      bucket,
      prSha,
      ['packages/ui/Button'],
      makeDeps()
    );

    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });

  it('does not call delete when nothing was uploaded', async () => {
    listAllObjectsMock.mockResolvedValue([]);

    await cleanupOrphanedNewImages(bucket, prSha, [], makeDeps());

    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });

  it('splits deletions into batches of 1000 keys', async () => {
    const objects = Array.from({ length: 1500 }, (_, i) => ({
      Key: `${prefix}packages/ui/Component-${i}/new.png`
    }));
    listAllObjectsMock.mockResolvedValue(objects);

    await cleanupOrphanedNewImages(bucket, prSha, [], makeDeps());

    expect(deleteObjectsMock).toHaveBeenCalledTimes(2);
    const firstBatch = deleteObjectsMock.mock.calls[0]?.[0] as any;
    const secondBatch = deleteObjectsMock.mock.calls[1]?.[0] as any;
    expect(firstBatch.Delete.Objects).toHaveLength(1000);
    expect(secondBatch.Delete.Objects).toHaveLength(500);
  });
});
