import { BASE_IMAGES_DIRECTORY, BASE_IMAGE_NAME } from 'shared/constants';
import type { Dependencies } from './dependencies';
import { isNoSuchKey, readBodyBytes } from './manifest-s3';

/**
 * Base images are content-addressed: an image is stored under the md5 that
 * the manifest records for it. A manifest entry is therefore a pointer to one
 * exact image rather than a description of whatever occupies a shared slot, so
 * the two cannot drift apart, and a PR behind the base branch can resolve the
 * image its own merge base recorded instead of the most recently written one.
 */
export function baseImageKey(path: string, hash: string): string {
  return `${BASE_IMAGES_DIRECTORY}/${path}/${hash}.png`;
}

/**
 * The single mutable object per screenshot that predates content addressing.
 * Still written on merge, because the standard `pr`/`merge` workflows and the
 * app's accept path both address base images by this name, and still read as a
 * fallback for screenshots that have not been merged through since.
 */
export function legacyBaseImageKey(path: string): string {
  return `${BASE_IMAGES_DIRECTORY}/${path}/${BASE_IMAGE_NAME}.png`;
}

export interface BaseImageReaderDeps {
  s3: Pick<Dependencies['s3'], 'getObject'>;
  core: Pick<Dependencies['core'], 'info'>;
}

export interface ResolvedBaseImage {
  buffer: Buffer;
  key: string;
  resolvedBy: 'hash' | 'legacy';
}

export type GetBaseImage = (
  bucket: string,
  path: string,
  hash: string | null
) => Promise<ResolvedBaseImage>;

export function makeBaseImageReader(deps: BaseImageReaderDeps): {
  getBaseImage: GetBaseImage;
} {
  async function download(bucket: string, key: string): Promise<Buffer> {
    const response = await deps.s3.getObject({ Bucket: bucket, Key: key });
    return Buffer.from(await readBodyBytes(response));
  }

  const getBaseImage: GetBaseImage = async (bucket, path, hash) => {
    if (hash) {
      const key = baseImageKey(path, hash);
      try {
        return {
          buffer: await download(bucket, key),
          key,
          resolvedBy: 'hash'
        };
      } catch (error: unknown) {
        if (!isNoSuchKey(error)) throw error;
        deps.core.info(
          `No content-addressed base image at ${key} — falling back to ${legacyBaseImageKey(path)}.`
        );
      }
    }

    const key = legacyBaseImageKey(path);
    return { buffer: await download(bucket, key), key, resolvedBy: 'legacy' };
  };

  return { getBaseImage };
}
