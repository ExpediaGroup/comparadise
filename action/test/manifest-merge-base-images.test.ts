/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  applyChangesetToBaseImages,
  type ApplyBaseImagesDeps
} from '../src/manifest-merge-base-images';
import type { Changeset } from '../src/manifest-s3';

const copyObjectMock = mock<any>();
const deleteObjectsMock = mock<any>();
const infoMock = mock<any>();

function makeDeps(
  overrides: Partial<ApplyBaseImagesDeps> = {}
): ApplyBaseImagesDeps {
  return {
    s3: { copyObject: copyObjectMock, deleteObjects: deleteObjectsMock } as any,
    core: { info: infoMock } as any,
    ...overrides
  };
}

const bucket = 'test-bucket';
const prSha = 'pr-sha-111';

describe('applyChangesetToBaseImages', () => {
  beforeEach(() => {
    copyObjectMock.mockReset().mockResolvedValue({});
    deleteObjectsMock.mockReset().mockResolvedValue({});
    infoMock.mockReset();
  });

  it('does nothing when the changeset has no real entries (only _headSha)', async () => {
    const changeset: Changeset = { _headSha: 'sha' };

    await applyChangesetToBaseImages({ bucket, prSha, changeset }, makeDeps());

    expect(copyObjectMock).not.toHaveBeenCalled();
    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });

  it('copies new.png to the hash-named base image and the legacy base.png', async () => {
    const changeset: Changeset = {
      _headSha: 'sha',
      'components/Button': 'h-button'
    };

    await applyChangesetToBaseImages({ bucket, prSha, changeset }, makeDeps());

    expect(copyObjectMock).toHaveBeenCalledTimes(2);
    expect(copyObjectMock.mock.calls.map(call => (call[0] as any).Key)).toEqual(
      [
        'base-images/components/Button/h-button.png',
        'base-images/components/Button/base.png'
      ]
    );
    for (const call of copyObjectMock.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          Bucket: bucket,
          CopySource:
            'test-bucket/new-images/pr-sha-111/components/Button/new.png'
        })
      );
    }
    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });

  it('url-encodes path segments in the CopySource', async () => {
    const changeset: Changeset = {
      _headSha: 'sha',
      'components/My Button': 'h'
    };

    await applyChangesetToBaseImages({ bucket, prSha, changeset }, makeDeps());

    const call = copyObjectMock.mock.calls[0]?.[0] as any;
    expect(call.CopySource).toBe(
      'test-bucket/new-images/pr-sha-111/components/My%20Button/new.png'
    );
  });

  it('deletes base.png for null (deleted) entries', async () => {
    const changeset: Changeset = {
      _headSha: 'sha',
      'components/Removed': null
    };

    await applyChangesetToBaseImages({ bucket, prSha, changeset }, makeDeps());

    expect(copyObjectMock).not.toHaveBeenCalled();
    expect(deleteObjectsMock).toHaveBeenCalledTimes(1);
    expect(deleteObjectsMock).toHaveBeenCalledWith({
      Bucket: bucket,
      Delete: {
        Objects: [{ Key: 'base-images/components/Removed/base.png' }]
      }
    });
  });

  it('handles a mix of copies and deletes', async () => {
    const changeset: Changeset = {
      _headSha: 'sha',
      A: 'h-a',
      B: null,
      C: 'h-c',
      D: null
    };

    await applyChangesetToBaseImages({ bucket, prSha, changeset }, makeDeps());

    // Two copies per surviving path: hash-named plus the legacy base.png.
    expect(copyObjectMock.mock.calls.map(call => (call[0] as any).Key)).toEqual(
      [
        'base-images/A/h-a.png',
        'base-images/A/base.png',
        'base-images/C/h-c.png',
        'base-images/C/base.png'
      ]
    );
    expect(deleteObjectsMock).toHaveBeenCalledTimes(1);
    const deleteCall = deleteObjectsMock.mock.calls[0]?.[0] as any;
    expect(deleteCall.Delete.Objects).toEqual([
      { Key: 'base-images/B/base.png' },
      { Key: 'base-images/D/base.png' }
    ]);
  });

  it('ignores the _headSha metadata field', async () => {
    const changeset: Changeset = { _headSha: 'sha' };

    await applyChangesetToBaseImages({ bucket, prSha, changeset }, makeDeps());

    // _headSha must not be treated as a path
    expect(copyObjectMock).not.toHaveBeenCalled();
    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });
});
