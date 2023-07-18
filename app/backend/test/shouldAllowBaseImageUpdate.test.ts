import { shouldAllowBaseImageUpdate } from '../src/shouldAllowBaseImageUpdate';
import { getOctokit } from '../src/getOctokit';
import {
  VISUAL_REGRESSION_CONTEXT,
  VISUAL_TESTS_FAILED_TO_EXECUTE,
} from 'shared';

jest.mock('../src/getOctokit');

describe('shouldAllowBaseImageUpdate', () => {
  it('should return true when all non-visual pr checks pass', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z',
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z',
              },
              {
                context: 'other tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z',
              },
            ],
          }),
        },
      },
    }));
    const result = await shouldAllowBaseImageUpdate(
      'github-owner',
      'github-repo',
      'sha',
    );
    expect(result).toBe(true);
  });

  it('should return false when at least one visual test job failed', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z',
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z',
              },
              {
                context: 'visual tests',
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z',
              },
            ],
          }),
        },
      },
    }));
    const result = await shouldAllowBaseImageUpdate(
      'github-owner',
      'github-repo',
      'sha',
    );
    expect(result).toBe(false);
  });

  it('should return false when at least one non-visual check failed', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z',
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z',
              },
              {
                context: 'other tests',
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z',
              },
            ],
          }),
        },
      },
    }));
    const result = await shouldAllowBaseImageUpdate(
      'github-owner',
      'github-repo',
      'sha',
    );
    expect(result).toBe(false);
  });

  it('should return false when all non-visual pr checks pass but some are pending', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z',
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z',
              },
              {
                context: 'other tests',
                state: 'pending',
                created_at: '2023-05-02T19:11:02Z',
              },
            ],
          }),
        },
      },
    }));
    const result = await shouldAllowBaseImageUpdate(
      'github-owner',
      'github-repo',
      'sha',
    );
    expect(result).toBe(false);
  });

  it('should return true when a non-visual check failed on an early run but passed on the latest run', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'failure',
                created_at: '2023-05-02T19:10:02Z',
              },
              {
                context: 'unit tests',
                state: 'success',
                created_at: '2023-05-02T19:11:02Z',
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z',
              },
            ],
          }),
        },
      },
    }));
    const result = await shouldAllowBaseImageUpdate(
      'github-owner',
      'github-repo',
      'sha',
    );
    expect(result).toBe(true);
  });

  it('should return false when a non-visual check fails on multiple runs and never passed', async () => {
    (getOctokit as jest.Mock).mockImplementation(() => ({
      rest: {
        repos: {
          listCommitStatusesForRef: jest.fn().mockReturnValue({
            data: [
              {
                context: 'unit tests',
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z',
              },
              {
                context: 'unit tests',
                state: 'failure',
                created_at: '2023-05-02T19:10:02Z',
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                created_at: '2023-05-02T19:11:02Z',
              },
            ],
          }),
        },
      },
    }));
    const result = await shouldAllowBaseImageUpdate(
      'github-owner',
      'github-repo',
      'sha',
    );
    expect(result).toBe(false);
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
                created_at: '2023-05-02T19:11:02Z',
              },
              {
                context: VISUAL_REGRESSION_CONTEXT,
                state: 'failure',
                description: VISUAL_TESTS_FAILED_TO_EXECUTE,
                created_at: '2023-05-02T19:11:02Z',
              },
            ],
          }),
        },
      },
    }));
    const result = await shouldAllowBaseImageUpdate(
      'github-owner',
      'github-repo',
      'sha',
    );
    expect(result).toBe(false);
  });
});
