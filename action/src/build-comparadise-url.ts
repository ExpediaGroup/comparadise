import { getBooleanInput, getInput } from '@actions/core';
import type { Dependencies } from './dependencies';

export interface ComparadiseUrlOptions {
  /**
   * Overrides the `use-base-images` input. Manifest mode passes false: an
   * accept there must not write `base-images/` itself, because
   * `manifest-merge` applies the accepted changeset when the PR lands — an
   * accept that wrote them too would move the shared baseline on behalf of a
   * PR that has not merged, and leave it describing an image no manifest
   * points at. Accepting consequently stops gating on the other PR checks,
   * which is the intended pairing: that gate exists because accepting used to
   * mutate the baseline immediately, and in manifest mode it no longer does.
   */
  useBaseImages?: boolean;
}

export const buildComparadiseUrl = (
  context: Dependencies['context'],
  options: ComparadiseUrlOptions = {}
) => {
  const bucketName = getInput('bucket-name', { required: true });
  const comparadiseHost = getInput('comparadise-host');
  const commitHash = getInput('commit-hash');
  const diffId = getInput('diff-id');
  const hashParam = commitHash
    ? `commitHash=${commitHash}`
    : `diffId=${diffId}`;
  const updateBaseImagesOnAccept = getBooleanInput(
    'update-base-images-on-accept'
  );
  const useBaseImages =
    options.useBaseImages ??
    (updateBaseImagesOnAccept && getBooleanInput('use-base-images'));
  const { owner, repo } = context.repo;

  return `${comparadiseHost}/?${hashParam}&owner=${owner}&repo=${repo}&bucket=${bucketName}&useBaseImages=${useBaseImages}`;
};
