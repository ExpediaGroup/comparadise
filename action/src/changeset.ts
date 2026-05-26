import type { Changeset, Manifest } from './manifest-s3';

export function computeChangeset(base: Manifest, pr: Manifest): Changeset {
  const changeset: Changeset = {};

  for (const [path, hash] of Object.entries(pr)) {
    if (base[path] !== hash) {
      changeset[path] = hash;
    }
  }

  for (const path of Object.keys(base)) {
    if (!(path in pr)) {
      changeset[path] = null;
    }
  }

  return changeset;
}
