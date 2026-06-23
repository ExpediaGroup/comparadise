import { defaultS3Operations, type S3Operations } from 'shared/s3';

export type Manifest = Record<string, string>;
export type Changeset = Record<string, string | null>;

export function makeManifestS3(s3: S3Operations = defaultS3Operations) {
  async function putManifest(
    bucket: string,
    sha: string,
    manifest: Manifest
  ): Promise<void> {
    await s3.putObject({
      Bucket: bucket,
      Key: `manifests/${sha}.json`,
      Body: JSON.stringify(manifest),
      ContentType: 'application/json'
    });
  }

  async function getManifest(
    bucket: string,
    sha: string
  ): Promise<Manifest | null> {
    try {
      const response = await s3.getObject({
        Bucket: bucket,
        Key: `manifests/${sha}.json`
      });
      const body = await response.Body!.transformToString();
      return JSON.parse(body) as Manifest;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  async function putChangeset(
    bucket: string,
    sha: string,
    changeset: Changeset
  ): Promise<void> {
    await s3.putObject({
      Bucket: bucket,
      Key: `changesets/${sha}.json`,
      Body: JSON.stringify(changeset),
      ContentType: 'application/json'
    });
  }

  async function getChangeset(
    bucket: string,
    sha: string
  ): Promise<Changeset | null> {
    try {
      const response = await s3.getObject({
        Bucket: bucket,
        Key: `changesets/${sha}.json`
      });
      const body = await response.Body!.transformToString();
      return JSON.parse(body) as Changeset;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Squash the per-package manifests a monorepo's matrix `manifest-generate`
   * jobs wrote under `manifests/{sha}/` into the single combined manifest at
   * `manifests/{sha}.json`, returning the merged result.
   *
   * Returns `null` when no per-package manifests exist (the single-package
   * case, where `manifests/{sha}.json` was already written directly by
   * `manifest-generate`) — nothing is written in that case.
   */
  async function squashPrManifest(
    bucket: string,
    sha: string
  ): Promise<Manifest | null> {
    const parts = await s3.listAllObjects({
      Bucket: bucket,
      Prefix: `manifests/${sha}/`
    });
    if (parts.length === 0) return null;

    const merged: Manifest = {};
    for (const part of parts) {
      if (!part.Key) continue;
      const response = await s3.getObject({ Bucket: bucket, Key: part.Key });
      const body = await response.Body!.transformToString();
      const partManifest = JSON.parse(body) as Manifest;
      for (const key of Object.keys(partManifest)) {
        if (key in merged) {
          throw new Error(
            `Duplicate manifest key "${key}" found while squashing per-package ` +
              `manifests under manifests/${sha}/. Check for overlapping package-paths.`
          );
        }
      }
      Object.assign(merged, partManifest);
    }

    await putManifest(bucket, sha, merged);
    return merged;
  }

  return {
    putManifest,
    getManifest,
    putChangeset,
    getChangeset,
    squashPrManifest
  };
}

export const {
  putManifest,
  getManifest,
  putChangeset,
  getChangeset,
  squashPrManifest
} = makeManifestS3();
