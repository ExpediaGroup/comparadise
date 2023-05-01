import { updateCommitStatus } from './updateCommitStatus';
import { getOctokit } from './getOctokit';

jest.mock('./getOctokit');
const createCommitStatus = jest.fn(() => ({ catch: jest.fn() }));
(getOctokit as jest.Mock).mockImplementation(() => ({
  rest: {
    repos: {
      createCommitStatus
    }
  }
}));

describe('updateCommitStatus', () => {
  it('calls github api correctly', async () => {
    await updateCommitStatus({ owner: 'github-owner', repo: 'github-repo', hash: 'hash' });
    expect(createCommitStatus).toHaveBeenCalledWith({
      owner: 'github-owner',
      repo: 'github-repo',
      sha: 'hash',
      state: 'success',
      description: 'Your visual tests have passed.',
      context: 'Visual Regression'
    });
  });
});
