import { octokit } from './octokit';
import { context } from '@actions/github';
import { VISUAL_REGRESSION_CONTEXT } from 'shared';
import { warning } from '@actions/core';

export const createCommitStatus = async (
  commitHash: string,
  state: 'failure' | 'success',
  description: string,
  targetUrl?: string
) => {
  try {
    return octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: VISUAL_REGRESSION_CONTEXT,
      state: state,
      description: description,
      ...(targetUrl && { target_url: targetUrl }),
      ...context.repo
    });
  } catch (err) {
    warning('Failed to update commit status.');
    throw err;
  }
};
