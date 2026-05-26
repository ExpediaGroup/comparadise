import { afterEach, describe, expect, it, mock } from 'bun:test';

const listPullRequestsAssociatedWithCommitMock = mock();
mock.module('../src/getOctokit', () => ({
  getOctokit: mock(() => ({
    rest: {
      repos: {
        listPullRequestsAssociatedWithCommit:
          listPullRequestsAssociatedWithCommitMock
      }
    }
  }))
}));
mock.module('@octokit/rest', () => ({
  Octokit: mock()
}));

import { getPullRequestUrl } from '../src/getPullRequestUrl';

describe('getPullRequestUrl', () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  it('returns html_url of the first PR when one is associated with the commit', async () => {
    listPullRequestsAssociatedWithCommitMock.mockResolvedValueOnce({
      data: [{ html_url: 'https://github.com/owner/repo/pull/42', number: 42 }]
    });

    const result = await getPullRequestUrl({
      owner: 'owner',
      repo: 'repo',
      commitHash: 'abc123'
    });

    expect(result).toEqual({
      url: 'https://github.com/owner/repo/pull/42'
    });
  });

  it('returns null when no PRs are associated with the commit', async () => {
    listPullRequestsAssociatedWithCommitMock.mockResolvedValueOnce({
      data: []
    });

    const result = await getPullRequestUrl({
      owner: 'owner',
      repo: 'repo',
      commitHash: 'abc123'
    });

    expect(result).toEqual({ url: null });
  });
});
