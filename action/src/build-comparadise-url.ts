import { getBooleanInput, getInput } from '@actions/core';
import { context } from '@actions/github';

export const buildComparadiseUrl = () => {
  const bucketName = getInput('bucket-name', { required: true });
  const comparadiseHost = getInput('comparadise-host');
  const commitHash = getInput('commit-hash');
  const diffId = getInput('diff-id');
  const hashParam = commitHash
    ? `commitHash=${commitHash}`
    : `diffId=${diffId}`;
  const useBaseImages = getBooleanInput('use-base-images') ?? true;
  const { owner, repo } = context.repo;

  return `${comparadiseHost}/?${hashParam}&owner=${owner}&repo=${repo}&bucket=${bucketName}&useBaseImages=${useBaseImages}`;
};
