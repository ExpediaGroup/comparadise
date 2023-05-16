import { octokit } from './octokit';
import { context } from '@actions/github';
import { getInput, setFailed } from '@actions/core';

export const createGithubComment = async () => {
  const bucketName = getInput('bucket-name', { required: true });
  const commitHash = getInput('commit-hash', { required: true });
  const comparadiseHost = getInput('comparadise-host');
  const { owner, repo } = context.repo;
  const comparadiseUrl = `${comparadiseHost}/?hash=${commitHash}&owner=${owner}&repo=${repo}&bucket=${bucketName}`;
  const comparadiseLink = comparadiseHost ? `[Comparadise](${comparadiseUrl})` : 'Comparadise';
  const comparadiseBaseComment = `**Visual tests failed!**\nCheck out the diffs on ${comparadiseLink}! :palm_tree:`;
  const comparadiseCommentDetails = getInput('comment-details');
  const comparadiseComment = comparadiseCommentDetails ? `${comparadiseBaseComment}\n${comparadiseCommentDetails}` : comparadiseBaseComment;

  const { data } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
    commit_sha: commitHash,
    ...context.repo
  });
  const prNumber = data.find(Boolean)?.number;
  if (!prNumber) {
    setFailed('No pull request found for commit hash.');
    return;
  }

  const { data: comments } = await octokit.rest.issues.listComments({
    issue_number: prNumber,
    ...context.repo
  });
  const githubActionsCommentBodies = comments.map(comment => comment.body);
  const comparadiseCommentExists = githubActionsCommentBodies.some(body => body?.includes(comparadiseBaseComment));
  if (!comparadiseCommentExists) {
    await octokit.rest.issues.createComment({
      body: comparadiseComment,
      issue_number: prNumber,
      ...context.repo
    });
  }
};
