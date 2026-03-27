import { existsSync, readFileSync } from 'fs';
import { TRPCError } from '@trpc/server';
import { Octokit } from '@octokit/rest';
import { secretsJsonSchema } from './schema';
import { IS_PROD } from '../../server';

export const getOctokit = (owner: string, repo: string) => {
  if (!IS_PROD) {
    return new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
  }
  const secretsFilePath = '/vault/secrets/secrets.json';
  if (!existsSync(secretsFilePath)) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Missing secrets.json file',
      cause: { event: 'MISSING_SECRETS_FILE' }
    });
  }
  const parsedJson = JSON.parse(readFileSync(secretsFilePath).toString());
  const result = secretsJsonSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to parse secrets.json: ${result.error}`,
      cause: { event: 'SECRETS_PARSE_ERROR' }
    });
  }
  const repoSecrets = result.data[`${owner}/${repo}`];
  const { githubToken, githubApiUrl } = repoSecrets ?? {};
  if (!githubToken) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: `Missing githubToken for repo ${owner}/${repo}`,
      cause: { event: 'MISSING_GITHUB_TOKEN' }
    });
  }
  return new Octokit({
    auth: githubToken,
    baseUrl: githubApiUrl
  });
};
