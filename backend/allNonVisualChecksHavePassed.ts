import {getOctokit} from "./getOctokit";

export const allNonVisualChecksHavePassed = async (owner: string, repo: string, sha: string): Promise<boolean> => {
    const octokit = getOctokit(owner, repo);

    const { data } = await octokit.rest.checks.listForRef({
        owner,
        repo,
        ref: sha
    });
    return data.check_runs.filter(({ name }) => !isVisualTest(name)).every(checkRun => checkRun.conclusion === 'success');
};

const visualTestRegex = /visual/ig
const isVisualTest = (testName: string) => visualTestRegex.test(testName)
