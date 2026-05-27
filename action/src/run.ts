import { getInput, getBooleanInput, getMultilineInput } from '@actions/core';
import {
  deleteHashImages,
  downloadBaseImages,
  uploadAllImages,
  uploadOriginalNewImages
} from './s3-operations';
import * as path from 'path';
import { createGithubComment, PackageResult } from './comment';
import { getLatestVisualRegressionStatus } from './get-latest-visual-regression-status';
import {
  VISUAL_REGRESSION_CONTEXT,
  VISUAL_TESTS_FAILED_TO_EXECUTE
} from 'shared/constants';
import { buildComparadiseUrl } from './build-comparadise-url';
import { disableAutoMerge } from './disable-auto-merge';
import { type Dependencies, makeDefaultDeps } from './dependencies';

export const run = async (deps: Dependencies = makeDefaultDeps()) => {
  const workflow = getInput('workflow') || 'pr';
  const commitHash = getInput('commit-hash');
  const diffId = getInput('diff-id');

  if (!commitHash && !diffId) {
    deps.core.setFailed('Please provide either a commit-hash or a diff-id.');
    return;
  }

  const hash = commitHash || diffId;

  if (workflow === 'merge') {
    deps.core.info(
      'Running in merge workflow mode — updating base images in S3.'
    );
    const bucket = getInput('bucket-name', { required: true });
    await deps.s3.updateBaseImages(hash, bucket, deps.core.info);
    deps.core.info('Base images updated successfully.');
    return;
  }

  const visualTestCommands = getMultilineInput('visual-test-command');
  if (!visualTestCommands.length) {
    deps.core.setFailed('visual-test-command is required when workflow is pr.');
    return;
  }

  const useBaseImages = getBooleanInput('use-base-images') ?? true;
  if (useBaseImages) {
    await downloadBaseImages(deps);
  }

  const visualTestExitCodes = await Promise.all(
    visualTestCommands.map(cmd =>
      deps.exec(cmd, [], { ignoreReturnCode: true })
    )
  );
  const numVisualTestFailures = visualTestExitCodes.filter(
    code => code !== 0
  ).length;

  const screenshotsDirectory = getInput('screenshots-directory');
  const screenshotsPath = path.join(process.cwd(), screenshotsDirectory);

  const orphanedNewPngs = await deps.glob(`**/screenshots/**/new.png`, {
    cwd: process.cwd(),
    absolute: true,
    ignore: ['**/node_modules/**', `${screenshotsPath}/**`]
  });
  if (orphanedNewPngs.length > 0) {
    deps.core.setFailed(
      `Screenshots were found outside the configured screenshots-directory ("${screenshotsDirectory}"): ${orphanedNewPngs.join(', ')}. Check that your screenshots-directory input points to where Cypress writes screenshots.`
    );
    return;
  }

  const filesInScreenshotDirectory = await deps.glob(
    `${screenshotsPath}/**/{base,diff,new}.png`,
    {
      absolute: false
    }
  );
  const diffFilePaths = filesInScreenshotDirectory.filter(file =>
    file.endsWith('diff.png')
  );
  const newFilePaths = filesInScreenshotDirectory.filter(file =>
    file.endsWith('new.png')
  );

  // Delete orphaned diff files (no corresponding new file)
  const validDiffFilePaths: string[] = [];
  const diffFileCount = diffFilePaths.reduce((count, diffPath) => {
    if (
      newFilePaths.some(
        newPath => path.dirname(newPath) === path.dirname(diffPath)
      )
    ) {
      validDiffFilePaths.push(diffPath);
      return count + 1;
    }
    deps.fs.unlinkSync(diffPath);
    return count;
  }, 0);

  const newFileCount = newFilePaths.length;

  const visualTestCommandFailsOnDiff = getBooleanInput(
    'visual-test-command-fails-on-diff'
  );

  if (visualTestCommandFailsOnDiff && numVisualTestFailures > diffFileCount) {
    deps.core.setFailed(
      'Visual tests failed to execute successfully. Perhaps one failed to take a screenshot?'
    );
    if (!commitHash) return;
    return deps.octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'failure',
      description: VISUAL_TESTS_FAILED_TO_EXECUTE,
      ...deps.context.repo
    });
  }

  if (!visualTestCommandFailsOnDiff && numVisualTestFailures > 0) {
    deps.core.setFailed('The job failed, and this is not due to visual tests.');
    return;
  }

  const latestVisualRegressionStatus = commitHash
    ? await getLatestVisualRegressionStatus(
        commitHash,
        deps.octokit,
        deps.context
      )
    : null;

  const isRetry = deps.context.runAttempt > 1;

  const testsPassed = diffFileCount === 0 && newFileCount === 0;
  if (testsPassed) {
    deps.core.info('All visual tests passed, and no diffs found!');

    if (isRetry) {
      await deleteHashImages(hash, deps);
    }

    if (!commitHash) return;
    if (isRetry) {
      deps.core.warning(
        'Disabling auto merge because this is a retry attempt. This is to avoid auto merging prematurely.'
      );
      await disableAutoMerge(commitHash, deps);
    } else if (latestVisualRegressionStatus?.state) {
      deps.core.info(
        'Skipping status update since Visual Regression status has already been set.'
      );
      return;
    }

    return deps.octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: VISUAL_REGRESSION_CONTEXT,
      state: 'success',
      description: `Visual tests passed${isRetry ? ' on retry' : ''}!`,
      ...deps.context.repo
    });
  }

  if (
    commitHash &&
    latestVisualRegressionStatus?.state === 'failure' &&
    latestVisualRegressionStatus?.description ===
      VISUAL_TESTS_FAILED_TO_EXECUTE &&
    !isRetry
  ) {
    deps.core.warning(
      'Some other Visual Regression tests failed to execute successfully, so skipping status update and comment.'
    );
    return;
  }

  const newVisualTestCount = newFileCount - diffFileCount;
  const newFileSuffix =
    newVisualTestCount > 0 ? ' and new visual tests created' : '';
  const pendingDescription = `Visual diffs found${newFileSuffix}.`;

  const packagePaths =
    getInput('package-paths')?.split(',').filter(Boolean) ?? [];
  const packageResults: PackageResult[] =
    packagePaths.length > 0
      ? packagePaths.map(pkg => {
          const prefix = path.join(screenshotsDirectory, pkg);
          const pkgDiffCount = validDiffFilePaths.filter(f =>
            f.startsWith(prefix)
          ).length;
          const pkgNewCount = newFilePaths.filter(f =>
            f.startsWith(prefix)
          ).length;
          return {
            packagePath: pkg,
            diffCount: pkgDiffCount,
            newTestCount: pkgNewCount - pkgDiffCount
          };
        })
      : [
          {
            packagePath: '',
            diffCount: diffFileCount,
            newTestCount: newVisualTestCount
          }
        ];

  deps.core.info(`${diffFileCount} visual differences found.`);
  await Promise.all([
    uploadAllImages(hash, deps),
    uploadOriginalNewImages(hash, deps)
  ]);
  if (!commitHash) return;
  await deps.octokit.rest.repos.createCommitStatus({
    sha: commitHash,
    context: VISUAL_REGRESSION_CONTEXT,
    state: 'pending',
    description: pendingDescription,
    target_url: buildComparadiseUrl(deps.context),
    ...deps.context.repo
  });
  await createGithubComment(packageResults, deps.octokit, deps.context);

  if (visualTestCommandFailsOnDiff && diffFileCount > 0) {
    deps.core.setFailed(pendingDescription);
  } else {
    deps.core.warning(pendingDescription);
  }
};
