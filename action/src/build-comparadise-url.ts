import { getInput } from '@actions/core';
import { context } from '@actions/github';

export const buildComparadiseUrl = (hash: string) => {
  const bucketName = getInput('bucket-name', { required: true });
  const comparadiseHost = getInput('comparadise-host');
  const { owner, repo } = context.repo;

  return `${comparadiseHost}/?hash=${hash}&owner=${owner}&repo=${repo}&bucket=${bucketName}`;
};
