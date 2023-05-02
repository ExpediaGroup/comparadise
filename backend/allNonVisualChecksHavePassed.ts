import { getOctokit } from './getOctokit';
import { RestEndpointMethodTypes } from '@octokit/rest';

type CheckRunConclusion = RestEndpointMethodTypes['checks']['listForRef']['response']['data']['check_runs'][number]['conclusion'];

const allowedConclusions: CheckRunConclusion[] = ['success', 'skipped'];
const visualTestRegex = /visual/gi;
const isVisualTest = (testName: string) => visualTestRegex.test(testName);

export const allNonVisualChecksHavePassed = async (owner: string, repo: string, sha: string): Promise<boolean> => {
  const octokit = getOctokit(owner, repo);

  const { data } = await octokit.rest.checks.listForRef({
    owner,
    repo,
    ref: sha
  });
  return data.check_runs.filter(({ name }) => !isVisualTest(name)).every(checkRun => allowedConclusions.includes(checkRun.conclusion));
};
