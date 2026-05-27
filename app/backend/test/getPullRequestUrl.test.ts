import { afterEach, describe, expect, it, mock } from 'bun:test';
import { getPullRequestUrl } from '../src/getPullRequestUrl';
import type { Octokit } from '@octokit/rest';

const listPullRequestsAssociatedWithCommitMock = mock();

const makeOctokit = (): Octokit =>
  ({
    rest: {
      repos: {
        listPullRequestsAssociatedWithCommit:
          listPullRequestsAssociatedWithCommitMock
      }
    }
  }) as unknown as Octokit;

describe('getPullRequestUrl', () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  it('returns html_url of the first PR when one is associated with the commit', async () => {
    listPullRequestsAssociatedWithCommitMock.mockResolvedValueOnce({
      data: [{ html_url: 'https://github.com/owner/repo/pull/42', number: 42 }]
    });

    const result = await getPullRequestUrl(
      { owner: 'owner', repo: 'repo', commitHash: 'abc123' },
      makeOctokit()
    );

    expect(result).toEqual({
      url: 'https://github.com/owner/repo/pull/42'
    });
  });

  it('returns null when no PRs are associated with the commit', async () => {
    listPullRequestsAssociatedWithCommitMock.mockResolvedValueOnce({
      data: []
    });

    const result = await getPullRequestUrl(
      { owner: 'owner', repo: 'repo', commitHash: 'abc123' },
      makeOctokit()
    );

    expect(result).toEqual({ url: null });
  });
});
