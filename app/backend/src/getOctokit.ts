import { readFileSync } from 'fs';
import { TRPCError } from '@trpc/server';
import { Octokit } from '@octokit/rest';

export const getOctokit = (owner: string, repo: string) => {
  try {
    const {
      [`${owner}/${repo}`]: { githubToken, githubApiUrl },
    } = JSON.parse(readFileSync(`/vault/secrets/secrets.json`).toString());
    return new Octokit({
      auth: githubToken,
      baseUrl: githubApiUrl,
    });
  } catch (error) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: `No GitHub configs were found for ${owner}/${repo}: ${error}`,
    });
  }
};
