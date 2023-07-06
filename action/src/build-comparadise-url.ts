import { getInput } from '@actions/core';
import { context } from '@actions/github';

export const buildComparadiseUrl = () => {
  const bucketName = getInput('bucket-name', { required: true });
  const commitHash = getInput('commit-hash', { required: true });
  const comparadiseHost = getInput('comparadise-host');
  const { owner, repo } = context.repo;

  return `${comparadiseHost}/?hash=${commitHash}&owner=${owner}&repo=${repo}&bucket=${bucketName}`;
};
