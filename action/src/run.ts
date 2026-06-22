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
import { manifestGenerate } from './manifest-generate';
import { manifestCompare } from './manifest-compare';
import { classifyManifests } from './manifest-compare-classify';
import { generateDiffs } from './manifest-diff';
import { diffPng } from './diff-png';
import { makeManifestS3 } from './manifest-s3';
import { manifestMerge } from './manifest-merge';
import {
  overlayChangeset,
  detectStaleConflicts
} from './manifest-merge-overlay';
import { applyChangesetToBaseImages } from './manifest-merge-base-images';
import { flagOverlappingOpenPrs } from './manifest-merge-flag-prs';
import { context as githubContext } from '@actions/github';
import type { CommentArgs } from './manifest-compare';

export const run = async (deps: Dependencies = makeDefaultDeps()) => {
  const workflow = getInput('workflow') || 'pr';

  if (workflow === 'manifest-generate') {
    await manifestGenerate(deps);
    return;
  }

  if (workflow === 'manifest-compare') {
    await runManifestCompareWorkflow(deps);
    return;
  }

  if (workflow === 'manifest-merge') {
    await runManifestMergeWorkflow(deps);
    return;
  }

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
    // Delete orphaned diff files (no corresponding new file)
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

async function runManifestCompareWorkflow(deps: Dependencies): Promise<void> {
  const bucket = getInput('bucket-name', { required: true });
  const prSha = getInput('commit-hash', { required: true });
  const baseRef =
    getInput('base-ref') || githubContext.payload.pull_request?.base?.ref;

  if (!baseRef) {
    deps.core.setFailed('base-ref is required for workflow manifest-compare.');
    return;
  }

  const manifestS3 = makeManifestS3(deps.s3);

  await manifestCompare(
    {
      bucket,
      prSha,
      repo: deps.context.repo,
      baseRef
    },
    {
      classify: params =>
        classifyManifests(params, {
          s3: deps.s3,
          octokit: deps.octokit,
          core: deps.core
        }),
      generateDiffs: params =>
        generateDiffs(params, {
          s3: deps.s3,
          core: deps.core,
          diffPng
        }),
      putChangeset: manifestS3.putChangeset,
      getPrManifest: manifestS3.getManifest,
      setCommitStatus: async params => {
        await deps.octokit.rest.repos.createCommitStatus({
          ...deps.context.repo,
          ...params
        });
      },
      postComment: args => postManifestCompareComment(args, deps),
      buildComparadiseUrl: () => buildComparadiseUrl(deps.context),
      core: deps.core
    }
  );
}

async function runManifestMergeWorkflow(deps: Dependencies): Promise<void> {
  const bucket = getInput('bucket-name', { required: true });

  const prSha =
    getInput('pr-sha') || githubContext.payload.pull_request?.head?.sha;
  const mergeCommitSha =
    getInput('merge-commit-sha') ||
    githubContext.payload.pull_request?.merge_commit_sha;

  const prNumberInput =
    getInput('pr-number') ||
    githubContext.payload.pull_request?.number?.toString();

  if (!prSha || !mergeCommitSha || !prNumberInput) {
    deps.core.setFailed(
      'pr-sha, merge-commit-sha, and pr-number are required for workflow manifest-merge.'
    );
    return;
  }

  const prNumber = Number(prNumberInput);
  if (!Number.isFinite(prNumber)) {
    deps.core.setFailed(`Invalid pr-number: ${prNumberInput}`);
    return;
  }

  const manifestS3 = makeManifestS3(deps.s3);

  await manifestMerge(
    {
      bucket,
      prNumber,
      prSha,
      mergeCommitSha,
      repo: deps.context.repo
    },
    {
      getManifest: manifestS3.getManifest,
      putManifest: manifestS3.putManifest,
      getChangeset: manifestS3.getChangeset,
      getMergeParentSha: async mergeSha => {
        const { data } = await deps.octokit.rest.repos.getCommit({
          ...deps.context.repo,
          ref: mergeSha
        });
        const parentSha = data.parents[0]?.sha;
        if (!parentSha) {
          throw new Error(
            `Merge commit ${mergeSha} has no parent commit to use as manifest base.`
          );
        }
        return parentSha;
      },
      flagOverlappingOpenPrs: params =>
        flagOverlappingOpenPrs(params, {
          octokit: deps.octokit,
          getChangeset: manifestS3.getChangeset,
          core: deps.core
        }),
      applyChangesetToBaseImages: params =>
        applyChangesetToBaseImages(params, {
          s3: deps.s3,
          core: deps.core
        }),
      overlayChangeset,
      detectStaleConflicts,
      core: deps.core
    }
  );
}

const MANIFEST_COMMENT_MARKER = '<!-- comparadise-manifest -->';

async function postManifestCompareComment(
  args: CommentArgs,
  deps: Dependencies
): Promise<void> {
  const prNumber = await resolvePrNumber(args.commitHash, deps);
  if (!prNumber) {
    deps.core.info('No PR number found, skipping manifest comment creation.');
    return;
  }

  const { data: comments } = await deps.octokit.rest.issues.listComments({
    ...deps.context.repo,
    issue_number: prNumber
  });

  const existing = comments.find(comment =>
    comment.body?.includes(MANIFEST_COMMENT_MARKER)
  );

  const body = buildManifestCommentBody(args, deps);

  if (!existing) {
    await deps.octokit.rest.issues.createComment({
      ...deps.context.repo,
      issue_number: prNumber,
      body
    });
    return;
  }

  await deps.octokit.rest.issues.updateComment({
    ...deps.context.repo,
    comment_id: existing.id,
    body
  });
}

function buildManifestCommentBody(
  args: CommentArgs,
  deps: Dependencies
): string {
  if (args.kind === 'conflict') {
    return `${MANIFEST_COMMENT_MARKER}\n## Visual Manifest Results\nVisual conflicts detected on ${args.conflicts.length} path(s). Please rebase this branch and rerun visual checks.\n\nConflicting paths:\n${args.conflicts.map(path => `- \`${path}\``).join('\n')}`;
  }

  const changedCount = args.prOwns.filter(
    entry => entry.type === 'changed'
  ).length;
  const addedCount = args.prOwns.filter(entry => entry.type === 'added').length;

  return `${MANIFEST_COMMENT_MARKER}\n## Visual Manifest Results\nVisual diffs found.\n\n- Changed screenshots: ${changedCount}\n- Added screenshots: ${addedCount}\n\nCheck [Comparadise](${buildComparadiseUrl(deps.context)}) for image details.`;
}

async function resolvePrNumber(
  commitHash: string,
  deps: Dependencies
): Promise<number | null> {
  const { data } =
    await deps.octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      ...deps.context.repo,
      commit_sha: commitHash
    });

  const prNumber = data.find(Boolean)?.number ?? deps.context.issue.number;
  return prNumber || null;
}
