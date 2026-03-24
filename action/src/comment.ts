import { octokit } from './octokit';
import { context } from '@actions/github';
import { getInput, info } from '@actions/core';
import { buildComparadiseUrl } from './build-comparadise-url';

export interface PackageResult {
  packagePath: string;
  diffCount: number;
  newTestCount: number;
}

const COMPARADISE_MARKER = '<!-- comparadise -->';
const TABLE_END_MARKER = '<!-- comparadise-table-end -->';

const buildHashMarker = (commitHash: string) =>
  `<!-- comparadise-hash:${commitHash} -->`;

const buildTable = (packageResults: PackageResult[]): string => {
  const hasPackages = packageResults.some(r => r.packagePath !== '');
  if (hasPackages) {
    const header =
      '| Package | Visual Diffs | New Visual Tests |\n|---------|-------------|-----------------|';
    const rows = packageResults
      .map(r => `| ${r.packagePath} | ${r.diffCount} | ${r.newTestCount} |`)
      .join('\n');
    return `${header}\n${rows}`;
  }
  const header =
    '| Visual Diffs | New Visual Tests |\n|-------------|-----------------|';
  const result = packageResults[0];
  const row = result ? `| ${result.diffCount} | ${result.newTestCount} |` : '';
  return `${header}\n${row}`;
};

const buildCommentBody = (
  commitHash: string,
  pendingDescription: string,
  packageResults: PackageResult[],
  comparadiseLink: string,
  commentDetails: string
): string => {
  const table = buildTable(packageResults);
  const base = `${COMPARADISE_MARKER}\n${buildHashMarker(commitHash)}\n## Visual Test Results\n${pendingDescription}\n\n${table}\n${TABLE_END_MARKER}\n\nCheck ${comparadiseLink}! :palm_tree:`;
  return commentDetails ? `${base}\n${commentDetails}` : base;
};

export const createGithubComment = async (
  pendingDescription: string,
  packageResults: PackageResult[]
) => {
  const commitHash = getInput('commit-hash', { required: true });
  const comparadiseHost = getInput('comparadise-host');
  const comparadiseUrl = buildComparadiseUrl();
  const comparadiseLink = comparadiseHost
    ? `[Comparadise](${comparadiseUrl})`
    : 'Comparadise';
  const commentDetails = getInput('comment-details');

  const { data } =
    await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      commit_sha: commitHash,
      ...context.repo
    });
  const prNumber = data.find(Boolean)?.number ?? context.issue.number;
  if (!prNumber) {
    info('No PR number found, skipping comment creation.');
    return;
  }

  const { data: comments } = await octokit.rest.issues.listComments({
    issue_number: prNumber,
    ...context.repo
  });

  const existingComment = comments.find(comment =>
    comment.body?.includes(COMPARADISE_MARKER)
  );

  if (!existingComment) {
    await octokit.rest.issues.createComment({
      body: buildCommentBody(
        commitHash,
        pendingDescription,
        packageResults,
        comparadiseLink,
        commentDetails
      ),
      issue_number: prNumber,
      ...context.repo
    });
    return;
  }

  const isSameCommit = existingComment.body?.includes(
    buildHashMarker(commitHash)
  );

  if (isSameCommit) {
    const newRows = buildTable(packageResults).split('\n').slice(2).join('\n');
    const updatedBody = existingComment.body!.replace(
      TABLE_END_MARKER,
      `${newRows}\n${TABLE_END_MARKER}`
    );
    await octokit.rest.issues.updateComment({
      comment_id: existingComment.id,
      body: updatedBody,
      ...context.repo
    });
  } else {
    await octokit.rest.issues.updateComment({
      comment_id: existingComment.id,
      body: buildCommentBody(
        commitHash,
        pendingDescription,
        packageResults,
        comparadiseLink,
        commentDetails
      ),
      ...context.repo
    });
  }
};
