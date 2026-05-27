import {
  getObject as defaultGetObject,
  putObject as defaultPutObject
} from 'shared/s3';

export type Manifest = Record<string, string>;
export type Changeset = Record<string, string | null>;

export interface ManifestS3Deps {
  getObject: typeof defaultGetObject;
  putObject: typeof defaultPutObject;
}

const defaultDeps: ManifestS3Deps = {
  getObject: defaultGetObject,
  putObject: defaultPutObject
};

export function makeManifestS3(deps: ManifestS3Deps = defaultDeps) {
  async function putManifest(
    bucket: string,
    sha: string,
    manifest: Manifest
  ): Promise<void> {
    await deps.putObject({
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
      const response = await deps.getObject({
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
    await deps.putObject({
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
      const response = await deps.getObject({
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

  return { putManifest, getManifest, putChangeset, getChangeset };
}

export const { putManifest, getManifest, putChangeset, getChangeset } =
  makeManifestS3();
