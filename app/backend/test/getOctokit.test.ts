import { existsSync, readFileSync } from 'fs';
import { getOctokit } from '../src/getOctokit';
import { Octokit } from '@octokit/rest';

jest.mock('fs');
jest.mock('@octokit/rest');

(existsSync as jest.Mock).mockReturnValue(true);

describe('getOctokitOptions', () => {
  it('should read secrets and generate octokit options', () => {
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
    getOctokit('github-owner', 'github-repo');
    expect(Octokit).toHaveBeenCalledWith({
      auth: 'some-token',
      baseUrl: 'api-url'
    });
  });

  it('does not throw if githubApiUrl is not provided', () => {
    (readFileSync as jest.Mock).mockImplementation(() => ({
      toString: jest.fn(() =>
        JSON.stringify({
          'github-owner/github-repo': {
            githubToken: 'some-token'
          }
        })
      )
    }));
    getOctokit('github-owner', 'github-repo');
    expect(Octokit).toHaveBeenCalledWith({
      auth: 'some-token'
    });
  });

  it('throws error if token not found', () => {
    (readFileSync as jest.Mock).mockImplementation(() => ({
      toString: jest.fn(() => JSON.stringify({}))
    }));
    expect(() => getOctokit('github-owner', 'github-repo')).toThrow(
      'Missing githubToken for repo github-owner/github-repo'
    );
  });
});
