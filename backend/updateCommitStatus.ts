import { readFileSync } from 'fs';
import { Octokit } from '@octokit/rest';
import { TRPCError } from '@trpc/server';

export const updateCommitStatus = async (owner: string, repo: string, sha: string) => {
  const octokitOptions = getOctokitOptions(owner, repo);
  return new Octokit(octokitOptions).rest.repos
    .createCommitStatus({
      owner,
      repo,
      sha,
      state: 'success',
      description: 'Your visual tests have passed.',
      context: 'Visual Regression'
    })
    .catch(error => {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to update GitHub commit status: ${error}`
      });
    });
};

const getOctokitOptions = (owner: string, repo: string) => {
  try {
    const {
      [`${owner}/${repo}`]: { githubToken, githubApiUrl }
    } = JSON.parse(readFileSync(`/vault/secrets/secrets.json`).toString());
    return {
      auth: githubToken,
      baseUrl: githubApiUrl
    };
  } catch (error) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: `No GitHub configs were found for ${owner}/${repo}: ${error}`
    });
  }
};
