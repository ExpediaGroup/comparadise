import { existsSync, readFileSync } from 'fs';
import { TRPCError } from '@trpc/server';
import { Octokit } from '@octokit/rest';
import { secretsJsonSchema } from './schema';

export const getOctokit = (owner: string, repo: string) => {
  const secretsFilePath = '/vault/secrets/secrets.json';
  if (!existsSync(secretsFilePath)) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Missing secrets.json file'
    });
  }
  const parsedJson = JSON.parse(readFileSync(secretsFilePath).toString());
  const result = secretsJsonSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to parse secrets.json: ${result.error}`
    });
  }
  const repoSecrets = result.data[`${owner}/${repo}`];
  const { githubToken, githubApiUrl } = repoSecrets ?? {};
  if (!githubToken) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: `Missing githubToken for repo ${owner}/${repo}`
    });
  }
  return new Octokit({
    auth: githubToken,
    baseUrl: githubApiUrl
  });
};
