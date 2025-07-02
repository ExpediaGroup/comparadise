import { updateCommitStatus } from '../src/updateCommitStatus';
import { getOctokit } from '../src/getOctokit';
import { VISUAL_REGRESSION_CONTEXT } from 'shared';
import { expect } from '@jest/globals';

jest.mock('../src/getOctokit');
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn()
}));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createCommitStatus = jest.fn((_: unknown) => ({ catch: jest.fn() }));
(getOctokit as jest.Mock).mockImplementation(() => ({
  rest: {
    repos: {
      createCommitStatus
    }
  }
}));

describe('updateCommitStatus', () => {
  it('calls github api correctly', async () => {
    await updateCommitStatus({
      owner: 'github-owner',
      repo: 'github-repo',
      commitHash: 'hash'
    });
    expect(createCommitStatus).toHaveBeenCalledWith({
      owner: 'github-owner',
      repo: 'github-repo',
      sha: 'hash',
      state: 'success',
      description: 'Base images updated successfully.',
      context: VISUAL_REGRESSION_CONTEXT
    });
  });
});
