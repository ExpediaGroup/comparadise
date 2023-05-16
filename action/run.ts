import { getInput, getMultilineInput, info, setFailed, warning } from '@actions/core';
import { downloadBaseImages, uploadBaseImages } from './s3-operations';
import { exec } from '@actions/exec';
import { octokit } from './octokit';
import { context } from '@actions/github';
import path from 'path';
import { sync } from 'glob';
import { createGithubComment } from './comment';

export const run = async () => {
  const visualTestCommands = getMultilineInput('visual-test-command', { required: true });
  const commitHash = getInput('commit-hash', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');

  await downloadBaseImages();

  const visualTestExitCode = await Promise.all(visualTestCommands.map(cmd => exec(cmd)));
  if (visualTestExitCode.some(code => code !== 0)) {
    setFailed('At least one visual test failed to take a screenshot.');
    await octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: 'Visual Regression',
      state: 'failure',
      description: 'At least one visual test failed to take a screenshot.',
      ...context.repo
    });
    return;
  }

  const screenshotsPath = path.join(process.cwd(), screenshotsDirectory);
  const filesInScreenshotDirectory = sync(`${screenshotsPath}/**`);
  const diffFileCount = filesInScreenshotDirectory.filter(file => file.endsWith('diff.png')).length;
  const newFileCount = filesInScreenshotDirectory.filter(file => file.endsWith('new.png')).length;
  if (diffFileCount === 0 && newFileCount === 0) {
    info('All visual tests passed, and no diffs found!');
    return octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: 'Visual Regression',
      state: 'success',
      description: 'Visual tests passed!',
      ...context.repo
    });
  }

  warning(`${diffFileCount} visual differences found, and ${newFileCount} new images found.`);
  await uploadBaseImages();
  await octokit.rest.repos.createCommitStatus({
    sha: commitHash,
    context: 'Visual Regression',
    state: 'failure',
    description: diffFileCount === 0 ? 'A new visual test was created!' : 'A visual regression was detected!',
    ...context.repo
  });
  await createGithubComment();
};
