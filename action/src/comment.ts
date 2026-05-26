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
const TIMESTAMP_MARKER = '<!-- comparadise-updated -->';

const buildTimestampLine = (): string => {
  const utcString = new Date().toUTCString().replace('GMT', 'UTC');
  const jobUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  return `_Last updated: ${utcString}_ | [GitHub Actions run](${jobUrl}) ${TIMESTAMP_MARKER}`;
};

const buildHashMarker = (commitHash: string) =>
  `<!-- comparadise-hash:${commitHash} -->`;

const buildTable = (packageResults: PackageResult[]): string => {
  const hasPackages = packageResults.some(r => r.packagePath !== '');
  const filteredResults = packageResults.filter(
    r => r.diffCount !== 0 || r.newTestCount !== 0
  );
  if (hasPackages) {
    const header =
      '| Package | Visual Diffs | New Visual Tests |\n|---------|-------------|-----------------|';
    const rows = filteredResults
      .map(r => `| ${r.packagePath} | ${r.diffCount} | ${r.newTestCount} |`)
      .join('\n');
    return `${header}\n${rows}`;
  }
  const header =
    '| Visual Diffs | New Visual Tests |\n|-------------|-----------------|';
  const result = filteredResults[0];
  const row = result ? `| ${result.diffCount} | ${result.newTestCount} |` : '';
  return `${header}\n${row}`;
};

const buildCommentBody = (
  commitHash: string,
  packageResults: PackageResult[],
  comparadiseLink: string,
  commentDetails: string
): string => {
  const table = buildTable(packageResults);
  const totalDiffs = packageResults.reduce((sum, r) => sum + r.diffCount, 0);
  const totalNewTests = packageResults.reduce(
    (sum, r) => sum + r.newTestCount,
    0
  );
  const newTestsSuffix =
    totalNewTests > 0
      ? `, ${totalNewTests} new visual ${totalNewTests === 1 ? 'test' : 'tests'}`
      : '';
  const heading = `${totalDiffs} visual ${totalDiffs === 1 ? 'diff' : 'diffs'}${newTestsSuffix}`;
  const base = `${COMPARADISE_MARKER}\n${buildHashMarker(commitHash)}\n## Visual Test Results\n${heading}\n\n${table}\n${TABLE_END_MARKER}\n\nCheck ${comparadiseLink}! :palm_tree:\n\n${buildTimestampLine()}`;
  return commentDetails ? `${base}\n${commentDetails}` : base;
};

export const createGithubComment = async (packageResults: PackageResult[]) => {
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

  if (!existingComment?.body) {
    await octokit.rest.issues.createComment({
      body: buildCommentBody(
        commitHash,
        packageResults,
        comparadiseLink,
        commentDetails
      ),
      issue_number: prNumber,
      ...context.repo
    });
    return;
  }

  const isSameCommit = existingComment.body.includes(
    buildHashMarker(commitHash)
  );

  if (isSameCommit) {
    const newRows = buildTable(packageResults).split('\n').slice(2).join('\n');
    const updatedBody = existingComment.body
      .replace(TABLE_END_MARKER, `${newRows}\n${TABLE_END_MARKER}`)
      .replace(new RegExp(`.*${TIMESTAMP_MARKER}`), buildTimestampLine());
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
        packageResults,
        comparadiseLink,
        commentDetails
      ),
      ...context.repo
    });
  }
};
