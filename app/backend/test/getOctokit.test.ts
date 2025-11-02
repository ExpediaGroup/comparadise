import { getOctokit } from '../src/getOctokit';
import { describe, expect, it, mock } from 'bun:test';

const existsSyncMock = mock(() => true);
const readFileSyncMock = mock();
mock.module('fs', () => ({
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock
}));
const octokitMock = mock();
mock.module('@octokit/rest', () => ({
  Octokit: octokitMock
}));

describe('getOctokitOptions', () => {
  it('should read secrets and generate octokit options', () => {
    readFileSyncMock.mockImplementation(() => ({
      toString: mock(() =>
        JSON.stringify({
          'github-owner/github-repo': {
            githubToken: 'some-token',
            githubApiUrl: 'api-url'
          }
        })
      )
    }));
    getOctokit('github-owner', 'github-repo');
    expect(octokitMock).toHaveBeenCalledWith({
      auth: 'some-token',
      baseUrl: 'api-url'
    });
  });

  it('does not throw if githubApiUrl is not provided', () => {
    readFileSyncMock.mockImplementation(() => ({
      toString: mock(() =>
        JSON.stringify({
          'github-owner/github-repo': {
            githubToken: 'some-token'
          }
        })
      )
    }));
    getOctokit('github-owner', 'github-repo');
    expect(octokitMock).toHaveBeenCalledWith({
      auth: 'some-token'
    });
  });

  it('throws error if token not found', () => {
    readFileSyncMock.mockImplementation(() => ({
      toString: mock(() => JSON.stringify({}))
    }));
    expect(() => getOctokit('github-owner', 'github-repo')).toThrow(
      'Missing githubToken for repo github-owner/github-repo'
    );
  });
});
