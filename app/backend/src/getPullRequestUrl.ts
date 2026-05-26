import { getOctokit } from './getOctokit';
import { GetPullRequestUrlInput } from './schema';

export const getPullRequestUrl = async ({
  owner,
  repo,
  commitHash
}: GetPullRequestUrlInput): Promise<{ url: string | null }> => {
  const octokit = getOctokit(owner, repo);
  const { data } =
    await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner,
      repo,
      commit_sha: commitHash
    });
  return { url: data[0]?.html_url ?? null };
};
