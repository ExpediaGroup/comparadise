import { run } from '../src/run';
import { exec } from '@actions/exec';
import { getInput, getMultilineInput, setFailed } from '@actions/core';
import { octokit } from '../src/octokit';
import { sync } from 'glob';
import {
  BASE_IMAGES_DIRECTORY,
  ExitCode,
  VISUAL_REGRESSION_CONTEXT,
  VISUAL_TESTS_FAILED_TO_EXECUTE
} from 'shared';
import { disableAutoMerge } from '../src/disableAutoMerge';

jest.mock('../src/disableAutoMerge');
jest.mock('glob');
jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('@actions/github', () => ({
  context: { repo: { repo: 'repo', owner: 'owner' } },
  getOctokit: jest.fn(() => ({
    rest: {
      repos: {
        createCommitStatus: jest.fn(),
        listPullRequestsAssociatedWithCommit: jest.fn(() => ({
          data: [{ number: 123 }]
        })),
        listCommitStatusesForRef: jest.fn(() => ({
          data: [
            {
              context: 'some context',
              created_at: '2023-05-21T16:51:29Z',
              state: 'success'
            }
          ]
        }))
      },
      issues: {
        createComment: jest.fn(),
        listComments: jest.fn(() => ({ data: [{ id: 1 }] }))
      }
    }
  }))
}));

const inputMap: Record<string, string> = {
  'screenshots-directory': 'path/to/screenshots',
  'bucket-name': 'some-bucket',
  'commit-hash': 'sha',
  'github-token': 'some-token',
  'comparadise-host': 'https://comparadise.app'
};
(getInput as jest.Mock).mockImplementation(name => inputMap[name]);
const multiLineInputMap: Record<string, string[]> = {
  'visual-test-command': ['run my visual tests']
};
(getMultilineInput as jest.Mock).mockImplementation(
  name => multiLineInputMap[name]
);

describe('main', () => {
  beforeEach(() => {
    process.env.GITHUB_RUN_ATTEMPT = '1';
  });

  it('should fail if visual tests fail', async () => {
    (exec as jest.Mock).mockResolvedValue(
      ExitCode.VISUAL_TESTS_FAILED_TO_EXECUTE
    );
    await run();
    expect(setFailed).toHaveBeenCalled();
    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'failure',
      description: VISUAL_TESTS_FAILED_TO_EXECUTE
    });
  });

  it('should pass if visual tests pass and no diffs or new images', async () => {
    (exec as jest.Mock).mockResolvedValue(0);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/base.png'
    ]);
    await run();
    expect(setFailed).not.toHaveBeenCalled();
    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'success',
      description: 'Visual tests passed!'
    });
  });

  it('should fail if visual tests pass and some diff images were created', async () => {
    (exec as jest.Mock).mockResolvedValue(ExitCode.VISUAL_DIFFS_DETECTED);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await run();
    expect(setFailed).not.toHaveBeenCalled();
    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'failure',
      description: 'A visual regression was detected. Check Comparadise!',
      target_url:
        'https://comparadise.app/?hash=sha&owner=owner&repo=repo&bucket=some-bucket'
    });
    expect(octokit.rest.issues.createComment).toHaveBeenCalled();
  });

  it('should pass and upload base images if visual tests pass and only new images were created', async () => {
    (exec as jest.Mock).mockResolvedValue(0);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/existingTest/base.png',
      'path/to/screenshots/newTest1/new.png',
      'path/to/screenshots/newTest2/new.png'
    ]);
    await run();
    expect(setFailed).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith(
      `aws s3 cp path/to/screenshots/newTest1/new.png s3://some-bucket/${BASE_IMAGES_DIRECTORY}/newTest1/base.png`
    );
    expect(exec).toHaveBeenCalledWith(
      `aws s3 cp path/to/screenshots/newTest2/new.png s3://some-bucket/${BASE_IMAGES_DIRECTORY}/newTest2/base.png`
    );
    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'success',
      description: 'New base images were created!'
    });
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it('should use subdirectories if provided', async () => {
    (exec as jest.Mock).mockResolvedValue(ExitCode.VISUAL_DIFFS_DETECTED);
    const extendedInputMap: Record<string, string> = {
      ...inputMap,
      'package-paths': 'path/1,path/2'
    };
    (getInput as jest.Mock).mockImplementation(name => extendedInputMap[name]);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await run();
    expect(exec).toHaveBeenCalledWith(
      `aws s3 cp s3://some-bucket/${BASE_IMAGES_DIRECTORY}/path/1 path/to/screenshots/path/1 --recursive`
    );
    expect(exec).toHaveBeenCalledWith(
      `aws s3 cp s3://some-bucket/${BASE_IMAGES_DIRECTORY}/path/2 path/to/screenshots/path/2 --recursive`
    );
    expect(exec).not.toHaveBeenCalledWith(
      `aws s3 cp s3://some-bucket/${BASE_IMAGES_DIRECTORY} path/to/screenshots --recursive`
    );
    expect(exec).toHaveBeenCalledWith(
      'aws s3 cp path/to/screenshots/path/1 s3://some-bucket/sha/path/1 --recursive'
    );
    expect(exec).toHaveBeenCalledWith(
      'aws s3 cp path/to/screenshots/path/2 s3://some-bucket/sha/path/2 --recursive'
    );
    expect(exec).not.toHaveBeenCalledWith(
      'aws s3 cp path/to/screenshots s3://some-bucket/sha --recursive'
    );
  });

  it('should not set successful commit status or create comment if the latest Visual Regression status is failure', async () => {
    (exec as jest.Mock).mockResolvedValue(0);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/base.png'
    ]);
    (
      octokit.rest.repos.listCommitStatusesForRef as unknown as jest.Mock
    ).mockResolvedValue({
      data: [
        {
          context: 'some context',
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T16:51:29Z',
          state: 'failure',
          description: 'A visual regression was detected!'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T15:51:29Z',
          state: 'success'
        }
      ]
    });
    await run();
    expect(octokit.rest.repos.createCommitStatus).not.toHaveBeenCalled();
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it('should set successful commit status if the latest Visual Regression status is not failure', async () => {
    (exec as jest.Mock).mockResolvedValue(0);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/base.png'
    ]);
    (
      octokit.rest.repos.listCommitStatusesForRef as unknown as jest.Mock
    ).mockResolvedValue({
      data: [
        {
          context: 'some context',
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T15:51:29Z',
          state: 'success'
        }
      ]
    });
    await run();
    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalled();
  });

  it('should not set commit status or create comment if the latest Visual Regression status is failure because tests failed to execute successfully', async () => {
    (exec as jest.Mock).mockResolvedValue(ExitCode.VISUAL_DIFFS_DETECTED);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    (
      octokit.rest.repos.listCommitStatusesForRef as unknown as jest.Mock
    ).mockResolvedValue({
      data: [
        {
          context: 'some context',
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T16:51:29Z',
          state: 'failure',
          description: VISUAL_TESTS_FAILED_TO_EXECUTE
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T15:51:29Z',
          state: 'success'
        }
      ]
    });
    await run();
    expect(setFailed).not.toHaveBeenCalled();
    expect(octokit.rest.repos.createCommitStatus).not.toHaveBeenCalled();
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it('should set successful commit status (and disable auto merge) if a visual test failed to execute but this is a re-run', async () => {
    process.env.GITHUB_RUN_ATTEMPT = '2';
    (exec as jest.Mock).mockResolvedValue(0);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/base.png'
    ]);
    (
      octokit.rest.repos.listCommitStatusesForRef as unknown as jest.Mock
    ).mockResolvedValue({
      data: [
        {
          context: 'some context',
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T16:51:29Z',
          state: 'failure',
          description: VISUAL_TESTS_FAILED_TO_EXECUTE
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T15:51:29Z',
          state: 'success'
        }
      ]
    });
    await run();
    expect(disableAutoMerge).toHaveBeenCalled();
    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalled();
  });

  it('should set failure commit status (and not disable auto merge) if a visual test failed to execute but this is a re-run', async () => {
    process.env.GITHUB_RUN_ATTEMPT = '2';
    (exec as jest.Mock).mockResolvedValue(ExitCode.VISUAL_DIFFS_DETECTED);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    (
      octokit.rest.repos.listCommitStatusesForRef as unknown as jest.Mock
    ).mockResolvedValue({
      data: [
        {
          context: 'some context',
          created_at: '2023-05-21T16:51:29Z',
          state: 'success'
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T16:51:29Z',
          state: 'failure',
          description: VISUAL_TESTS_FAILED_TO_EXECUTE
        },
        {
          context: VISUAL_REGRESSION_CONTEXT,
          created_at: '2023-05-21T15:51:29Z',
          state: 'success'
        }
      ]
    });
    await run();
    expect(disableAutoMerge).not.toHaveBeenCalled();
    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalled();
  });
});
