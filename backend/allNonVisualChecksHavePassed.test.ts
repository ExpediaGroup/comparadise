import { allNonVisualChecksHavePassed } from './allNonVisualChecksHavePassed';
import { getOctokit } from './getOctokit';

jest.mock('./getOctokit');

describe('allNonVisualChecksHavePassed', () => {
  it('should return true when all non-visual pr checks pass', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        checks: {
          listForRef: jest.fn().mockReturnValue({
            data: {
              check_runs: [
                {
                  name: 'unit tests',
                  conclusion: 'success'
                },
                {
                  name: 'visual tests',
                  conclusion: 'failure'
                },
                {
                  name: 'other tests',
                  conclusion: 'success'
                }
              ]
            }
          })
        }
      }
    }));
    const result = await allNonVisualChecksHavePassed('github-owner', 'github-repo', 'sha');
    expect(result).toBe(true);
  });

  it('should return false when at least one non-visual check failed', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        checks: {
          listForRef: jest.fn().mockReturnValue({
            data: {
              check_runs: [
                {
                  name: 'unit tests',
                  conclusion: 'success'
                },
                {
                  name: 'visual tests',
                  conclusion: 'failure'
                },
                {
                  name: 'other tests',
                  conclusion: 'failure'
                }
              ]
            }
          })
        }
      }
    }));
    const result = await allNonVisualChecksHavePassed('github-owner', 'github-repo', 'sha');
    expect(result).toBe(false);
  });

  it('should return true when all non-visual pr checks pass but some are skipped', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        checks: {
          listForRef: jest.fn().mockReturnValue({
            data: {
              check_runs: [
                {
                  name: 'unit tests',
                  conclusion: 'success'
                },
                {
                  name: 'visual tests',
                  conclusion: 'failure'
                },
                {
                  name: 'other tests',
                  conclusion: 'skipped'
                }
              ]
            }
          })
        }
      }
    }));
    const result = await allNonVisualChecksHavePassed('github-owner', 'github-repo', 'sha');
    expect(result).toBe(true);
  });
});
