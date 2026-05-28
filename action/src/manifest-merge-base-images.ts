import {
  BASE_IMAGES_DIRECTORY,
  BASE_IMAGE_NAME,
  NEW_IMAGES_DIRECTORY,
  NEW_IMAGE_NAME
} from 'shared/constants';
import type { Dependencies } from './dependencies';
import type { Changeset } from './manifest-s3';

const HEAD_SHA_KEY = '_headSha';

export interface ApplyBaseImagesDeps {
  s3: Pick<Dependencies['s3'], 'copyObject' | 'deleteObjects'>;
  core: Pick<Dependencies['core'], 'info'>;
}

export interface ApplyBaseImagesParams {
  bucket: string;
  prSha: string;
  changeset: Changeset;
}

/**
 * Apply a changeset to the `base-images/` directory in S3:
 *   - non-null entries: copy `new-images/{prSha}/{path}/new.png` to
 *     `base-images/{path}/base.png`
 *   - null entries: delete `base-images/{path}/base.png`
 *
 * The `_headSha` metadata field is ignored.
 */
export async function applyChangesetToBaseImages(
  params: ApplyBaseImagesParams,
  deps: ApplyBaseImagesDeps
): Promise<void> {
  const { bucket, prSha, changeset } = params;

  const copies: Array<{ path: string; hash: string }> = [];
  const deletes: string[] = [];

  for (const [path, hash] of Object.entries(changeset)) {
    if (path === HEAD_SHA_KEY) continue;
    if (hash === null) {
      deletes.push(path);
    } else {
      copies.push({ path, hash });
    }
  }

  if (copies.length === 0 && deletes.length === 0) return;

  deps.core.info(
    `Applying changeset to base images: ${copies.length} copy, ${deletes.length} delete.`
  );

  await Promise.all([
    ...copies.map(({ path }) =>
      deps.s3.copyObject({
        Bucket: bucket,
        CopySource: encodeS3CopySource(
          bucket,
          `${NEW_IMAGES_DIRECTORY}/${prSha}/${path}/${NEW_IMAGE_NAME}.png`
        ),
        Key: `${BASE_IMAGES_DIRECTORY}/${path}/${BASE_IMAGE_NAME}.png`,
        ACL: 'bucket-owner-full-control'
      })
    ),
    deletes.length > 0
      ? deps.s3.deleteObjects({
          Bucket: bucket,
          Delete: {
            Objects: deletes.map(path => ({
              Key: `${BASE_IMAGES_DIRECTORY}/${path}/${BASE_IMAGE_NAME}.png`
            }))
          }
        })
      : Promise.resolve()
  ]);
}

function encodeS3CopySource(bucket: string, key: string): string {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
