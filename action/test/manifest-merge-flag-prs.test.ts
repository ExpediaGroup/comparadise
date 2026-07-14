/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  flagOverlappingOpenPrs,
  type FlagOverlappingPrsDeps
} from '../src/manifest-merge-flag-prs';
import type { Changeset } from '../src/manifest-s3';

const paginateMock = mock<any>();
const listPullsMock = mock<any>();
const createCommitStatusMock = mock<any>();
const getChangesetMock = mock<any>();
const infoMock = mock<any>();

function makeDeps(
  overrides: Partial<FlagOverlappingPrsDeps> = {}
): FlagOverlappingPrsDeps {
  return {
    octokit: {
      paginate: paginateMock,
      rest: {
        pulls: { list: listPullsMock },
        repos: { createCommitStatus: createCommitStatusMock }
      }
    } as any,
    getChangeset: getChangesetMock,
    core: { info: infoMock } as any,
    ...overrides
  };
}

const bucket = 'test-bucket';
const repo = { owner: 'test-org', repo: 'test-repo' };
const mergingPrNumber = 100;

const mergingChangeset: Changeset = {
  _headSha: 'merging-head',
  Button: 'h-button',
  Modal: null
};

describe('flagOverlappingOpenPrs', () => {
  beforeEach(() => {
    paginateMock.mockReset();
    listPullsMock.mockReset();
    createCommitStatusMock.mockReset().mockResolvedValue({});
    getChangesetMock.mockReset();
    infoMock.mockReset();
  });

  it('does nothing when there are no open PRs', async () => {
    paginateMock.mockResolvedValue([]);

    const flagged = await flagOverlappingOpenPrs(
      { bucket, repo, mergingPrNumber, mergingChangeset },
      makeDeps()
    );

    expect(flagged).toEqual([]);
    expect(createCommitStatusMock).not.toHaveBeenCalled();
  });

  it('skips the merging PR itself', async () => {
    paginateMock.mockResolvedValue([
      { number: mergingPrNumber, head: { sha: 'merging-head' } }
    ]);

    const flagged = await flagOverlappingOpenPrs(
      { bucket, repo, mergingPrNumber, mergingChangeset },
      makeDeps()
    );

    expect(flagged).toEqual([]);
    expect(getChangesetMock).not.toHaveBeenCalled();
    expect(createCommitStatusMock).not.toHaveBeenCalled();
  });

  it('skips open PRs that have no changeset in S3', async () => {
    paginateMock.mockResolvedValue([
      { number: 200, head: { sha: 'pr-200-head' } }
    ]);
    getChangesetMock.mockResolvedValue(null);

    const flagged = await flagOverlappingOpenPrs(
      { bucket, repo, mergingPrNumber, mergingChangeset },
      makeDeps()
    );

    expect(flagged).toEqual([]);
    expect(createCommitStatusMock).not.toHaveBeenCalled();
  });

  it('does not flag PRs whose changesets do not overlap', async () => {
    paginateMock.mockResolvedValue([
      { number: 200, head: { sha: 'pr-200-head' } }
    ]);
    getChangesetMock.mockResolvedValue({
      _headSha: 'sha',
      OtherThing: 'h-other'
    } as Changeset);

    const flagged = await flagOverlappingOpenPrs(
      { bucket, repo, mergingPrNumber, mergingChangeset },
      makeDeps()
    );

    expect(flagged).toEqual([]);
    expect(createCommitStatusMock).not.toHaveBeenCalled();
  });

  it('flags PRs whose changesets overlap on at least one path', async () => {
    paginateMock.mockResolvedValue([
      { number: 200, head: { sha: 'pr-200-head' } }
    ]);
    getChangesetMock.mockResolvedValue({
      _headSha: 'sha',
      Button: 'h-button-other',
      OtherThing: 'h-other'
    } as Changeset);

    const flagged = await flagOverlappingOpenPrs(
      { bucket, repo, mergingPrNumber, mergingChangeset },
      makeDeps()
    );

    expect(flagged).toEqual([200]);
    expect(createCommitStatusMock).toHaveBeenCalledTimes(1);
    expect(createCommitStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...repo,
        sha: 'pr-200-head',
        state: 'failure'
      })
    );
    const call = createCommitStatusMock.mock.calls[0]?.[0] as any;
    expect(call.description).toMatch(/rebase/i);
  });

  it('ignores _headSha when computing overlap', async () => {
    paginateMock.mockResolvedValue([
      { number: 200, head: { sha: 'pr-200-head' } }
    ]);
    // Same _headSha but no real path overlap — must not flag
    getChangesetMock.mockResolvedValue({
      _headSha: 'merging-head',
      OtherThing: 'h-other'
    } as Changeset);

    const flagged = await flagOverlappingOpenPrs(
      { bucket, repo, mergingPrNumber, mergingChangeset },
      makeDeps()
    );

    expect(flagged).toEqual([]);
  });

  it('flags multiple overlapping PRs and leaves non-overlapping alone', async () => {
    paginateMock.mockResolvedValue([
      { number: 200, head: { sha: 'pr-200-head' } },
      { number: 300, head: { sha: 'pr-300-head' } },
      { number: 400, head: { sha: 'pr-400-head' } }
    ]);
    getChangesetMock
      // PR 200 overlaps on Button
      .mockResolvedValueOnce({
        _headSha: 'sha',
        Button: 'other-hash'
      } as Changeset)
      // PR 300 doesn't overlap
      .mockResolvedValueOnce({
        _headSha: 'sha',
        Unrelated: 'h'
      } as Changeset)
      // PR 400 overlaps on Modal (which is null in merging)
      .mockResolvedValueOnce({
        _headSha: 'sha',
        Modal: 'h-modal-other'
      } as Changeset);

    const flagged = await flagOverlappingOpenPrs(
      { bucket, repo, mergingPrNumber, mergingChangeset },
      makeDeps()
    );

    expect(flagged.sort()).toEqual([200, 400]);
    expect(createCommitStatusMock).toHaveBeenCalledTimes(2);
  });
});
