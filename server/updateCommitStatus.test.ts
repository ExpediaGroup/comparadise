import { readFileSync } from 'fs';
import { updateCommitStatus } from './updateCommitStatus';
import { Octokit } from '@octokit/rest';

jest.mock('fs');
jest.mock('@octokit/rest');
const createCommitStatus = jest.fn(() => ({ catch: jest.fn() }));
(Octokit as unknown as jest.Mock).mockImplementation(() => ({
  rest: {
    repos: {
      createCommitStatus
    }
  }
}));

describe('updateCommitStatus', () => {
  it('calls github api correctly', async () => {
    (readFileSync as jest.Mock).mockImplementation(() => ({
      toString: jest.fn(() =>
        JSON.stringify({
          'github-owner/github-repo': {
            githubToken: 'some-token',
            githubApiUrl: 'api-url'
          }
        })
      )
    }));
    await updateCommitStatus('github-owner', 'github-repo', 'hash');
    expect(Octokit).toHaveBeenCalledWith({
      auth: 'some-token',
      baseUrl: 'api-url'
    });
    expect(createCommitStatus).toHaveBeenCalledWith({
      owner: 'github-owner',
      repo: 'github-repo',
      sha: 'hash',
      state: 'success',
      description: 'Your visual tests have passed.',
      context: 'Visual Regression'
    });
  });

  it('throws error if config not found', async () => {
    (readFileSync as jest.Mock).mockImplementation(() => ({
      toString: jest.fn(() => JSON.stringify({}))
    }));
    await expect(() => updateCommitStatus('github-owner', 'github-repo', 'hash')).rejects.toThrow(
      /No GitHub configs were found for github-owner\/github-repo/
    );
    expect(createCommitStatus).not.toHaveBeenCalled();
  });
});
