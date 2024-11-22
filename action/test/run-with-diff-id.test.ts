import { run } from '../src/run';
import { exec } from '@actions/exec';
import { getInput, getMultilineInput, setFailed } from '@actions/core';
import { octokit } from '../src/octokit';
import { sync } from 'glob';
import { BASE_IMAGES_DIRECTORY, NEW_IMAGES_DIRECTORY } from 'shared';
import { expect } from '@jest/globals';

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
        listPullRequestsAssociatedWithCommit: jest.fn(),
        listCommitStatusesForRef: jest.fn()
      },
      issues: {
        createComment: jest.fn(),
        listComments: jest.fn()
      }
    }
  }))
}));

const inputMap: Record<string, string> = {
  'screenshots-directory': 'path/to/screenshots',
  'bucket-name': 'some-bucket',
  'diff-id': 'uniqueId',
  'github-token': 'some-token',
  'comparadise-host': 'https://comparadise.app'
};

// Helper to assert no calls to `octokit.rest` methods
const assertNoOctokitCalls = () => {
  const allMethods = [
    octokit.rest.repos.createCommitStatus,
    octokit.rest.repos.listPullRequestsAssociatedWithCommit,
    octokit.rest.repos.listCommitStatusesForRef,
    octokit.rest.issues.createComment,
    octokit.rest.issues.listComments
  ];
  allMethods.forEach(method => {
    expect(method).not.toHaveBeenCalled();
  });
};

describe('main with diff-id', () => {
  beforeEach(() => {
    process.env.GITHUB_RUN_ATTEMPT = '1';

    (getInput as jest.Mock).mockReset();
    (getInput as jest.Mock).mockImplementation(name => inputMap[name]);

    const multiLineInputMap: Record<string, string[]> = {
      'visual-test-command': ['run my visual tests']
    };
    (getMultilineInput as jest.Mock).mockImplementation(
      name => multiLineInputMap[name]
    );
  });

  it('should fail when both diff-id and commit-hash are provided', async () => {
    const extendedInputMap: Record<string, string> = {
      ...inputMap,
      'diff-id': '12345',
      'commit-hash': 'sha'
    };
    (getInput as jest.Mock).mockImplementation(name => extendedInputMap[name]);
    (exec as jest.Mock).mockResolvedValue(0);
    await run();
    expect(setFailed).toHaveBeenCalledWith(
      'You cannot provide both commit-hash and diff-id. Please choose one.'
    );
  });

  it('should fail when neither diff-id nor commit-hash is provided', async () => {
    const extendedInputMap: Record<string, string | undefined> = {
      ...inputMap,
      'diff-id': undefined,
      'commit-hash': undefined
    };
    (getInput as jest.Mock).mockImplementation(name => extendedInputMap[name]);
    (exec as jest.Mock).mockResolvedValue(0);
    await run();
    expect(setFailed).toHaveBeenCalledWith(
      'Please provide either a commit-hash or a diff-id.'
    );
  });

  it('should pass when only diff-id is provided', async () => {
    const hashInputMap: Record<string, string | undefined> = {
      'diff-id': '12345',
      'commit-hash': undefined
    };

    (getInput as jest.Mock).mockImplementation(name =>
      hashInputMap.hasOwnProperty(name) ? hashInputMap[name] : inputMap[name]
    );
    (exec as jest.Mock).mockResolvedValue(0);
    await run();
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('should fail if visual tests fail', async () => {
    (exec as jest.Mock).mockResolvedValue(1);
    await run();
    expect(setFailed).toHaveBeenCalled();
    assertNoOctokitCalls();
  });

  it('should pass if visual tests pass and no diffs or new images', async () => {
    (exec as jest.Mock).mockResolvedValue(0);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/base.png'
    ]);
    await run();
    expect(setFailed).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalledWith();
    assertNoOctokitCalls();
  });

  it('should fail if visual tests pass and some diff images were created', async () => {
    (exec as jest.Mock).mockResolvedValue(1);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png',
      'path/to/another-screenshot/diff.png'
    ]);
    await run();
    expect(setFailed).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalledWith('rm path/to/screenshots/diff.png');
    expect(exec).toHaveBeenCalledWith('rm path/to/another-screenshot/diff.png');
    assertNoOctokitCalls();
  });

  it('should fail if some visual tests fail and some diff images were created', async () => {
    const multiLineInputMapMultipleCommands: Record<string, string[]> = {
      'visual-test-command': ['run my visual tests', 'ok thank you']
    };
    (getMultilineInput as jest.Mock).mockImplementation(
      name => multiLineInputMapMultipleCommands[name]
    );
    (exec as jest.Mock).mockResolvedValue(1);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/base.png',
      'path/to/screenshots/diff.png',
      'path/to/screenshots/new.png'
    ]);
    await run();
    expect(setFailed).toHaveBeenCalled();
    assertNoOctokitCalls();
  });

  it('should pass if visual tests initially fail but pass on retry', async () => {
    (exec as jest.Mock).mockResolvedValue(0);
    (sync as unknown as jest.Mock).mockReturnValue([
      'path/to/screenshots/diff.png'
    ]);
    await run();
    expect(setFailed).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith('rm path/to/screenshots/diff.png');
    assertNoOctokitCalls();
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
    assertNoOctokitCalls();
  });

  it('should use subdirectories if provided', async () => {
    (exec as jest.Mock).mockResolvedValue(1);
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
      `aws s3 cp path/to/screenshots/path/1 s3://some-bucket/${NEW_IMAGES_DIRECTORY}/uniqueId/path/1 --recursive`
    );
    expect(exec).toHaveBeenCalledWith(
      `aws s3 cp path/to/screenshots/path/2 s3://some-bucket/${NEW_IMAGES_DIRECTORY}/uniqueId/path/2 --recursive`
    );
    expect(exec).not.toHaveBeenCalledWith(
      `aws s3 cp path/to/screenshots s3://some-bucket/${NEW_IMAGES_DIRECTORY}/sha --recursive`
    );
    assertNoOctokitCalls();
  });
});
