import { run } from './run';
import { exec } from '@actions/exec';
import { getInput, getMultilineInput, setFailed } from '@actions/core';
import { octokit } from './octokit';
import { sync } from 'glob';

jest.mock('glob');
jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('@actions/github', () => ({
  context: { repo: { repo: 'repo', owner: 'owner' } },
  getOctokit: jest.fn(() => ({
    rest: {
      repos: {
        createCommitStatus: jest.fn(),
        listPullRequestsAssociatedWithCommit: jest.fn(() => ({ data: [{ number: 123 }] }))
      },
      issues: { createComment: jest.fn(), listComments: jest.fn(() => ({ data: [{ id: 1 }] })) }
    }
  }))
}));

const inputMap = {
  'screenshots-directory': 'path/to/screenshots',
  'bucket-name': 'some-bucket',
  'commit-hash': 'sha',
  'base-images-directory': 'base-images',
  'github-token': 'some-token'
};
(getInput as jest.Mock).mockImplementation(name => inputMap[name]);
const multiLineInputMap = {
  'visual-test-command': ['run my visual tests']
};
(getMultilineInput as jest.Mock).mockImplementation(name => multiLineInputMap[name]);

describe('main', () => {
  it('should fail if visual tests fail', async () => {
    (exec as jest.Mock).mockResolvedValue(1);
    await run();
    expect(setFailed).toHaveBeenCalledWith('At least one visual test failed to take a screenshot.');
    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: 'Visual Regression',
      state: 'failure',
      description: 'At least one visual test failed to take a screenshot.'
    });
  });

  it('should pass if visual tests pass and no diffs or new images', async () => {
    (exec as jest.Mock).mockResolvedValue(0);
    (sync as jest.Mock).mockReturnValue(['path/to/screenshots/base.png']);
    await run();
    expect(setFailed).not.toHaveBeenCalled();
    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: 'Visual Regression',
      state: 'success',
      description: 'Visual tests passed!'
    });
  });

  it('should fail if visual tests pass and some diffs or new images', async () => {
    (exec as jest.Mock).mockResolvedValue(0);
    (sync as jest.Mock).mockReturnValue(['path/to/screenshots/base.png', 'path/to/screenshots/diff.png', 'path/to/screenshots/new.png']);
    await run();
    expect(setFailed).not.toHaveBeenCalled();
    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      sha: 'sha',
      context: 'Visual Regression',
      state: 'failure',
      description: 'A visual regression was detected!'
    });
    expect(octokit.rest.issues.createComment).toHaveBeenCalled();
  });

  it('should use subdirectories if provided', async () => {
    (exec as jest.Mock).mockResolvedValue(0);
    (getInput as jest.Mock).mockImplementation(name => ({ ...inputMap, 'package-paths': 'path/1,path/2' }[name]));
    (sync as jest.Mock).mockReturnValue(['path/to/screenshots/base.png', 'path/to/screenshots/diff.png', 'path/to/screenshots/new.png']);
    await run();
    expect(exec).toHaveBeenCalledWith('aws s3 cp s3://some-bucket/base-images/path/1 path/to/screenshots/path/1 --recursive');
    expect(exec).toHaveBeenCalledWith('aws s3 cp s3://some-bucket/base-images/path/2 path/to/screenshots/path/2 --recursive');
    expect(exec).not.toHaveBeenCalledWith('aws s3 cp s3://some-bucket/base-images path/to/screenshots --recursive');
    expect(exec).toHaveBeenCalledWith('aws s3 cp path/to/screenshots/path/1 s3://some-bucket/sha/path/1 --recursive');
    expect(exec).toHaveBeenCalledWith('aws s3 cp path/to/screenshots/path/2 s3://some-bucket/sha/path/2 --recursive');
    expect(exec).not.toHaveBeenCalledWith('aws s3 cp path/to/screenshots s3://some-bucket/sha --recursive');
  });
});
