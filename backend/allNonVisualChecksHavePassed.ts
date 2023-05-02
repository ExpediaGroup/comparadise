import { getOctokit } from './getOctokit';
import { RestEndpointMethodTypes } from '@octokit/rest';
import { groupBy, isEqual, sortBy } from 'lodash';

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
  const nonVisualChecks = data.check_runs.filter(({ name }) => !isVisualTest(name));
  const groupedChecks = groupBy(nonVisualChecks, 'name');
  const mostRecentChecks = nonVisualChecks.filter(check => {
    const checksSortedByDescTime = sortBy(groupedChecks[check.name], 'completed_at').reverse();
    return isEqual(check, checksSortedByDescTime[0]);
  });
  return mostRecentChecks.every(({ conclusion }) => allowedConclusions.includes(conclusion));
};
