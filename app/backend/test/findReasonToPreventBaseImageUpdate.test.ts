import { findReasonToPreventVisualChangeAcceptance } from '../src/findReasonToPreventVisualChangeAcceptance';
import { getOctokit } from '../src/getOctokit';
import {
  VISUAL_REGRESSION_CONTEXT,
  VISUAL_TESTS_FAILED_TO_EXECUTE
} from 'shared';
import { expect } from '@jest/globals';

jest.mock('../src/getOctokit', () => ({
  getOctokit: jest.fn()
}));

describe('findReasonToPreventVisualChangeAcceptance', () => {
  it('should return undefined when all non-visual pr checks pass', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z'
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z'
              },
              {
                context: 'other tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z'
              }
            ]
          })
        }
      }
    }));
    const result = await findReasonToPreventVisualChangeAcceptance(
      'github-owner',
      'github-repo',
      'sha'
    );
    expect(result).toBeUndefined();
  });

  it('should return a reason to prevent update when at least one non-visual check failed', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z'
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z'
              },
              {
                context: 'other tests',
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z'
              },
              {
                context: 'even more tests',
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z'
              }
            ]
          })
        }
      }
    }));
    const result = await findReasonToPreventVisualChangeAcceptance(
      'github-owner',
      'github-repo',
      'sha'
    );
    expect(result).toBe(
      'All other PR checks must pass before updating base images! These checks have not passed on your PR: other tests, even more tests'
    );
  });

  it('should return a reason to prevent update when all non-visual pr checks pass but some are pending', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z'
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z'
              },
              {
                context: 'other tests',
                state: 'pending',
                created_at: '2023-05-02T19:11:02Z'
              }
            ]
          })
        }
      }
    }));
    const result = await findReasonToPreventVisualChangeAcceptance(
      'github-owner',
      'github-repo',
      'sha'
    );
    expect(result).toBe(
      'All other PR checks must pass before updating base images! These checks have not passed on your PR: other tests'
    );
  });

  it('should return undefined when a non-visual check failed on an early run but passed on the latest run', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'failure',
                created_at: '2023-05-02T19:10:02Z'
              },
              {
                context: 'unit tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z'
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z'
              }
            ]
          })
        }
      }
    }));
    const result = await findReasonToPreventVisualChangeAcceptance(
      'github-owner',
      'github-repo',
      'sha'
    );
    expect(result).toBeUndefined();
  });

  it('should return a reason to prevent update when a non-visual check fails on multiple runs and never passed', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z'
              },
              {
                context: 'unit tests',
                state: 'failure',
                created_at: '2023-05-02T19:10:02Z'
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z'
              }
            ]
          })
        }
      }
    }));
    const result = await findReasonToPreventVisualChangeAcceptance(
      'github-owner',
      'github-repo',
      'sha'
    );
    expect(result).toBe(
      'All other PR checks must pass before updating base images! These checks have not passed on your PR: unit tests'
    );
  });

  it('should return false when visual tests failed to execute successfully', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z'
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                description: VISUAL_TESTS_FAILED_TO_EXECUTE,
                created_at: '2023-05-02T19:11:02Z'
              }
            ]
          })
        }
      }
    }));
    const result = await findReasonToPreventVisualChangeAcceptance(
      'github-owner',
      'github-repo',
      'sha'
    );
    expect(result).toBe(
      'At least one visual test job failed to take a screenshot. All jobs must take a screenshot before reviewing and updating base images!'
    );
  });
});
