import { getObject, putObject } from 'shared/s3';

export type Manifest = Record<string, string>;
export type Changeset = Record<string, string | null>;

export async function putManifest(
  bucket: string,
  sha: string,
  manifest: Manifest
): Promise<void> {
  await putObject({
    Bucket: bucket,
    Key: `manifests/${sha}.json`,
    Body: JSON.stringify(manifest),
    ContentType: 'application/json'
  });
}

export async function getManifest(
  bucket: string,
  sha: string
): Promise<Manifest | null> {
  try {
    const response = await getObject({
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

export async function putChangeset(
  bucket: string,
  sha: string,
  changeset: Changeset
): Promise<void> {
  await putObject({
    Bucket: bucket,
    Key: `changesets/${sha}.json`,
    Body: JSON.stringify(changeset),
    ContentType: 'application/json'
  });
}

export async function getChangeset(
  bucket: string,
  sha: string
): Promise<Changeset | null> {
  try {
    const response = await getObject({
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
