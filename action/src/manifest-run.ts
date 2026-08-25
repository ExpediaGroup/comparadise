import { getInput } from '@actions/core';
import { context as githubContext } from '@actions/github';
import { makeManifestS3 } from './manifest-s3';
import { manifestCompare } from './manifest-compare';
import { classifyManifests } from './manifest-compare-classify';
import { generateDiffs } from './manifest-diff';
import { diffPng } from './diff-png';
import { manifestMerge } from './manifest-merge';
import {
  overlayChangeset,
  detectStaleConflicts
} from './manifest-merge-overlay';
import { applyChangesetToBaseImages } from './manifest-merge-base-images';
import { flagOverlappingOpenPrs } from './manifest-merge-flag-prs';
import { buildComparadiseUrl } from './build-comparadise-url';
import { type Dependencies } from './dependencies';
import type { CommentArgs } from './manifest-compare';

export async function runManifestCompareWorkflow(
  deps: Dependencies
): Promise<void> {
  const bucket = getInput('bucket-name', { required: true });
  const prSha = getInput('commit-hash', { required: true });
  const baseRef = githubContext.payload.pull_request?.base?.ref;

  if (!baseRef) {
    deps.core.setFailed(
      'manifest-compare must run on a pull_request event; base ref could not be resolved from the event payload.'
    );
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
      squashPrManifest: manifestS3.squashPrManifest,
      classify: params =>
        classifyManifests(params, {
          s3: deps.s3,
          octokit: deps.octokit,
          core: deps.core,
          getManifest: manifestS3.getManifest
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

interface MergeEntry {
  prSha: string;
  mergeCommitSha: string;
  prNumber: number;
}

export async function runManifestMergeWorkflow(
  deps: Dependencies
): Promise<void> {
  const bucket = getInput('bucket-name', { required: true });

  // The common case: one PR merged via `pull_request: closed`, read straight from the event
  // payload. A merge queue batching multiple PRs' checks together can still deliver their squash
  // commits as a single `push` event though, in which case there's no pull_request payload to
  // read at all — fall back to push's own already-ordered (oldest first) commits list, resolving
  // each one's PR and awaiting the merges strictly in that order. That avoids relying on separate
  // pull_request events (whose relative delivery order GitHub does not guarantee) to fire and get
  // processed in landing order.
  const pullRequestEntry = resolvePullRequestEventEntry();
  if (pullRequestEntry) {
    await mergeEntry(bucket, pullRequestEntry, deps);
    return;
  }

  const pushCommitShas = resolvePushEventCommitShas();
  if (pushCommitShas.length === 0) {
    deps.core.setFailed(
      'manifest-merge requires a pull_request (closed) event or a push event with commits.'
    );
    return;
  }

  for (const mergeCommitSha of pushCommitShas) {
    const entry = await resolveMergeEntryFromCommit(mergeCommitSha, deps);
    if (!entry) {
      deps.core.info(
        `No pull request associated with commit ${mergeCommitSha}; skipping.`
      );
      continue;
    }
    await mergeEntry(bucket, entry, deps);
  }
}

function resolvePullRequestEventEntry(): MergeEntry | null {
  const prSha = githubContext.payload.pull_request?.head?.sha;
  const mergeCommitSha = githubContext.payload.pull_request?.merge_commit_sha;
  const prNumber = githubContext.payload.pull_request?.number;

  if (!prSha || !mergeCommitSha || !prNumber) return null;
  return { prSha, mergeCommitSha, prNumber };
}

function resolvePushEventCommitShas(): string[] {
  const commits = githubContext.payload.commits as
    | Array<{ id: string }>
    | undefined;
  return commits?.map(commit => commit.id) ?? [];
}

async function resolveMergeEntryFromCommit(
  mergeCommitSha: string,
  deps: Dependencies
): Promise<MergeEntry | null> {
  const { data: associatedPrs } =
    await deps.octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      ...deps.context.repo,
      commit_sha: mergeCommitSha
    });
  const prNumber = associatedPrs.find(Boolean)?.number;
  if (!prNumber) return null;

  const { data: pr } = await deps.octokit.rest.pulls.get({
    ...deps.context.repo,
    pull_number: prNumber
  });

  return { prSha: pr.head.sha, mergeCommitSha, prNumber };
}

async function mergeEntry(
  bucket: string,
  entry: MergeEntry,
  deps: Dependencies
): Promise<void> {
  const manifestS3 = makeManifestS3(deps.s3);

  await manifestMerge(
    {
      bucket,
      prNumber: entry.prNumber,
      prSha: entry.prSha,
      mergeCommitSha: entry.mergeCommitSha,
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
