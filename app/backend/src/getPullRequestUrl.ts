import { getOctokit } from './getOctokit';
import { GetPullRequestUrlInput } from './schema';
import type { Octokit } from '@octokit/rest';

export const getPullRequestUrl = async (
  { owner, repo, commitHash }: GetPullRequestUrlInput,
  octokit: Octokit = getOctokit(owner, repo)
): Promise<{ url: string | null }> => {
  const { data } =
    await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner,
      repo,
      commit_sha: commitHash
    });
  return { url: data[0]?.html_url ?? null };
};
