import { updateCommitStatus } from '../src/updateCommitStatus';
import { VISUAL_REGRESSION_CONTEXT } from 'shared';
import { describe, expect, it, mock } from 'bun:test';

const createCommitStatusMock = mock(() => ({ catch: mock() }));
const getOctokitMock = mock(() => ({
  rest: {
    repos: {
      createCommitStatus: createCommitStatusMock
    }
  }
}));
mock.module('../src/getOctokit', () => ({
  getOctokit: getOctokitMock
}));

describe('updateCommitStatus', () => {
  it('calls github api correctly', async () => {
    await updateCommitStatus({
      owner: 'github-owner',
      repo: 'github-repo',
      commitHash: 'hash'
    });
    expect(createCommitStatusMock).toHaveBeenCalledWith({
      owner: 'github-owner',
      repo: 'github-repo',
      sha: 'hash',
      state: 'success',
      description: 'Base images updated successfully.',
      context: VISUAL_REGRESSION_CONTEXT
    });
  });
});
