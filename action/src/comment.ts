import { octokit } from './octokit';
import { context } from '@actions/github';
import { getInput, info } from '@actions/core';
import { buildComparadiseUrl } from './build-comparadise-url';

export const createGithubComment = async () => {
  const commitHash = getInput('commit-hash', { required: true });
  const comparadiseHost = getInput('comparadise-host');
  const comparadiseUrl = buildComparadiseUrl();
  const comparadiseLink = comparadiseHost
    ? `[Comparadise](${comparadiseUrl})`
    : 'Comparadise';
  const comparadiseBaseComment = `**Visual tests failed!**\nCheck out the diffs on ${comparadiseLink}! :palm_tree:`;
  const comparadiseCommentDetails = getInput('comment-details');
  const comparadiseComment = comparadiseCommentDetails
    ? `${comparadiseBaseComment}\n${comparadiseCommentDetails}`
    : comparadiseBaseComment;

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
  const githubActionsCommentBodies = comments.map(comment => comment.body);
  const comparadiseCommentExists = githubActionsCommentBodies.some(body =>
    body?.includes(comparadiseBaseComment)
  );
  if (!comparadiseCommentExists) {
    await octokit.rest.issues.createComment({
      body: comparadiseComment,
      issue_number: prNumber,
      ...context.repo
    });
  }
};
