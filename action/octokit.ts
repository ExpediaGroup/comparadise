import { getOctokit } from '@actions/github';
import { getInput } from '@actions/core';

export const octokit = getOctokit(getInput('github-token'));
