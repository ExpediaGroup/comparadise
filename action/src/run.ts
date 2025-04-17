import {
  getInput,
  getBooleanInput,
  getMultilineInput,
  info,
  setFailed,
  warning
} from '@actions/core';
import {
  downloadBaseImages,
  uploadBaseImages,
  uploadAllImages
} from './s3-operations';
import { exec } from '@actions/exec';
import { octokit } from './octokit';
import { context } from '@actions/github';
import * as path from 'path';
import { sync } from 'glob';
import { createGithubComment } from './comment';
import { getLatestVisualRegressionStatus } from './get-latest-visual-regression-status';
import {
  VISUAL_REGRESSION_CONTEXT,
  VISUAL_TESTS_FAILED_TO_EXECUTE
} from 'shared';
import { buildComparadiseUrl } from './build-comparadise-url';
import { disableAutoMerge } from './disable-auto-merge';

export const run = async () => {
  const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  const isRetry = runAttempt > 1;
  const visualTestCommands = getMultilineInput('visual-test-command', {
    required: true
  });
  const commitHash = getInput('commit-hash');
  const diffId = getInput('diff-id');

  if (!commitHash && !diffId) {
    setFailed('Please provide either a commit-hash or a diff-id.');
    return;
  }

  const hash = commitHash || diffId;

  const screenshotsDirectory = getInput('screenshots-directory');

  const downloadImages = getBooleanInput('download-base-images') ?? true;
  if (downloadImages) {
    await downloadBaseImages();
  }

  const visualTestExitCode = await Promise.all(
    visualTestCommands.map(cmd => exec(cmd, [], { ignoreReturnCode: true }))
  );
  const numVisualTestFailures = visualTestExitCode.filter(
    code => code !== 0
  ).length;

  const screenshotsPath = path.join(process.cwd(), screenshotsDirectory);
  const filesInScreenshotDirectory =
    sync(`${screenshotsPath}/**`, { absolute: false }) || [];
  const diffFilePaths = filesInScreenshotDirectory.filter(file =>
    file.endsWith('diff.png')
  );
  const newFilePaths = filesInScreenshotDirectory.filter(file =>
    file.endsWith('new.png')
  );
  const diffFileCount = diffFilePaths.reduce((count, diffPath) => {
    if (
      newFilePaths.some(
        newPath => path.dirname(newPath) === path.dirname(diffPath)
      )
    ) {
      return count + 1;
    }
    exec(`rm ${diffPath}`);
    return count;
  }, 0);
  const newFileCount = newFilePaths.length;

  if (numVisualTestFailures > diffFileCount) {
    setFailed(
      'Visual tests failed to execute successfully. Perhaps one failed to take a screenshot?'
    );
    if (!commitHash) return;
    return octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'failure',
      description: VISUAL_TESTS_FAILED_TO_EXECUTE,
      ...context.repo
    });
  }

  const latestVisualRegressionStatus = commitHash
    ? await getLatestVisualRegressionStatus(commitHash)
    : null;

  if (diffFileCount === 0 && newFileCount === 0) {
    info('All visual tests passed, and no diffs found!');

    if (!commitHash) return;
    if (isRetry) {
      warning(
        'Disabling auto merge because this is a retry attempt. This is to avoid auto merging prematurely.'
      );
      await disableAutoMerge(commitHash);
    } else if (latestVisualRegressionStatus?.state === 'failure') {
      info(
        'Skipping status update since Visual Regression status has already been set to failed.'
      );
      return;
    }

    return octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'success',
      description: `Visual tests passed${isRetry ? ' on retry' : ''}!`,
      ...context.repo
    });
  }

  if (
    commitHash &&
    latestVisualRegressionStatus?.state === 'failure' &&
    latestVisualRegressionStatus?.description ===
      VISUAL_TESTS_FAILED_TO_EXECUTE &&
    !isRetry
  ) {
    warning(
      'Some other Visual Regression tests failed to execute successfully, so skipping status update and comment.'
    );
    return;
  }

  info(
    `${diffFileCount} visual differences found, and ${newFileCount} new images found.`
  );

  if (diffFileCount === 0 && newFileCount > 0) {
    info(
      `New visual tests found! ${newFileCount} images will be uploaded as new base images.`
    );
    await uploadBaseImages(newFilePaths);
    if (!commitHash) return;
    return octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'success',
      description: 'New base images were created!',
      ...context.repo
    });
  }

  await uploadAllImages(hash);
  if (!commitHash) return;
  await octokit.rest.repos.createCommitStatus({
    sha: commitHash,
    context: VISUAL_REGRESSION_CONTEXT,
    state: 'failure',
    description: 'A visual regression was detected. Check Comparadise!',
    target_url: buildComparadiseUrl(),
    ...context.repo
  });
  await createGithubComment();
};
