import { allNonVisualChecksHavePassed } from '../src/allNonVisualChecksHavePassed';
import { getOctokit } from '../src/getOctokit';
import { VISUAL_REGRESSION_CONTEXT } from 'shared';

jest.mock('../src/getOctokit');

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
                  conclusion: 'success',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: VISUAL_REGRESSION_CONTEXT,
                  conclusion: 'failure',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: 'other tests',
                  conclusion: 'success',
                  completed_at: '2023-05-02T19:11:02Z'
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

  it('should return false when at least one visual test job failed', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        checks: {
          listForRef: jest.fn().mockReturnValue({
            data: {
              check_runs: [
                {
                  name: 'unit tests',
                  conclusion: 'success',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: VISUAL_REGRESSION_CONTEXT,
                  conclusion: 'failure',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: 'visual tests',
                  conclusion: 'failure',
                  completed_at: '2023-05-02T19:11:02Z'
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

  it('should return false when at least one non-visual check failed', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        checks: {
          listForRef: jest.fn().mockReturnValue({
            data: {
              check_runs: [
                {
                  name: 'unit tests',
                  conclusion: 'success',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: VISUAL_REGRESSION_CONTEXT,
                  conclusion: 'failure',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: 'other tests',
                  conclusion: 'failure',
                  completed_at: '2023-05-02T19:11:02Z'
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
                  conclusion: 'success',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: VISUAL_REGRESSION_CONTEXT,
                  conclusion: 'failure',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: 'other tests',
                  conclusion: 'skipped',
                  completed_at: '2023-05-02T19:11:02Z'
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

  it('should return true when a non-visual check failed on an early run but passed on the latest run', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        checks: {
          listForRef: jest.fn().mockReturnValue({
            data: {
              check_runs: [
                {
                  name: 'unit tests',
                  conclusion: 'failure',
                  completed_at: '2023-05-02T19:10:02Z'
                },
                {
                  name: 'unit tests',
                  conclusion: 'success',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: VISUAL_REGRESSION_CONTEXT,
                  conclusion: 'failure',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: 'other tests',
                  conclusion: 'skipped',
                  completed_at: '2023-05-02T19:11:02Z'
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

  it('should return false when a non-visual check fails on multiple runs and never passed', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        checks: {
          listForRef: jest.fn().mockReturnValue({
            data: {
              check_runs: [
                {
                  name: 'unit tests',
                  conclusion: 'failure',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: 'unit tests',
                  conclusion: 'failure',
                  completed_at: '2023-05-02T19:10:02Z'
                },
                {
                  name: VISUAL_REGRESSION_CONTEXT,
                  conclusion: 'failure',
                  completed_at: '2023-05-02T19:11:02Z'
                },
                {
                  name: 'other tests',
                  conclusion: 'skipped',
                  completed_at: '2023-05-02T19:11:02Z'
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
});
