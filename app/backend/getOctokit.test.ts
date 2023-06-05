import { readFileSync } from 'fs';
import { getOctokit } from './getOctokit';
import { Octokit } from '@octokit/rest';
import { expect } from '@jest/globals';

jest.mock('fs');
jest.mock('@octokit/rest');

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

  it('throws error if config not found', () => {
    (readFileSync as jest.Mock).mockImplementation(() => ({
      toString: jest.fn(() => JSON.stringify({}))
    }));
    expect(() => getOctokit('github-owner', 'github-repo')).toThrow(/No GitHub configs were found for github-owner\/github-repo/);
  });
});
