import { getInput, getMultilineInput, info, setFailed, warning } from '@actions/core';
import { downloadBaseImages, uploadBaseImages } from './s3-operations';
import { exec } from '@actions/exec';
import { octokit } from './octokit';
import { context } from '@actions/github';
import * as path from 'path';
import { sync } from 'glob';
import { createGithubComment } from './comment';
import { getLatestVisualRegressionStatus } from './get-latest-visual-regression-status';
import { VISUAL_REGRESSION_CONTEXT } from '../constants';

export const run = async () => {
  const visualTestCommands = getMultilineInput('visual-test-command', { required: true });
  const commitHash = getInput('commit-hash', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');

  await downloadBaseImages();

  const visualTestExitCode = await Promise.all(visualTestCommands.map(cmd => exec(cmd)));
  if (visualTestExitCode.some(code => code !== 0)) {
    setFailed('Visual tests failed to execute successfully. Perhaps one failed to take a screenshot?');
    return octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'failure',
      description: 'Visual tests failed to execute successfully.',
      ...context.repo
    });
  }

  const screenshotsPath = path.join(process.cwd(), screenshotsDirectory);
  const filesInScreenshotDirectory = sync(`${screenshotsPath}/**`);
  const diffFileCount = filesInScreenshotDirectory.filter(file => file.endsWith('diff.png')).length;
  const newFileCount = filesInScreenshotDirectory.filter(file => file.endsWith('new.png')).length;
  if (diffFileCount === 0 && newFileCount === 0) {
    info('All visual tests passed, and no diffs found!');

    const latestVisualRegressionStatus = await getLatestVisualRegressionStatus(commitHash);
    if (latestVisualRegressionStatus?.state === 'failure') {
      info('Visual Regression status has already been set to failed, so skipping status update.');
      return;
    }

    return octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'success',
      description: 'Visual tests passed!',
      ...context.repo
    });
  }

  const latestVisualRegressionStatus = await getLatestVisualRegressionStatus(commitHash);
  if (
    latestVisualRegressionStatus?.state === 'failure' &&
    latestVisualRegressionStatus?.description === 'Visual tests failed to execute successfully.'
  ) {
    warning('Some other Visual Regression tests failed to execute successfully, so skipping status update and comment.');
    return;
  }

  warning(`${diffFileCount} visual differences found, and ${newFileCount} new images found.`);
  await uploadBaseImages();
  await octokit.rest.repos.createCommitStatus({
    sha: commitHash,
    context: VISUAL_REGRESSION_CONTEXT,
    state: 'failure',
    description: diffFileCount === 0 ? 'A new visual test was created!' : 'A visual regression was detected!',
    ...context.repo
  });
  await createGithubComment();
};