import { NEW_IMAGES_DIRECTORY, NEW_IMAGE_NAME } from 'shared/constants';
import type { Dependencies } from './dependencies';
import { baseImageKey, legacyBaseImageKey } from './manifest-base-images';
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
 *     `base-images/{path}/{hash}.png`, and to `base-images/{path}/base.png`
 *   - null entries: delete `base-images/{path}/base.png`
 *
 * Each image is written under the hash the changeset records for it, which is
 * what the manifest points at, so an accepted image can never be mistaken for
 * a different one. The legacy `base.png` is written alongside it because the
 * standard `pr`/`merge` workflows and the app's accept path address base
 * images by that name.
 *
 * Deletions only remove `base.png`: the hash-named objects a path accumulated
 * are unreferenced once the manifest entry is gone, and are left to the
 * bucket's lifecycle policy rather than tracked here.
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
    ...copies.flatMap(({ path, hash }) => {
      const copySource = encodeS3CopySource(
        bucket,
        `${NEW_IMAGES_DIRECTORY}/${prSha}/${path}/${NEW_IMAGE_NAME}.png`
      );
      return [baseImageKey(path, hash), legacyBaseImageKey(path)].map(key =>
        deps.s3.copyObject({
          Bucket: bucket,
          CopySource: copySource,
          Key: key,
          ACL: 'bucket-owner-full-control'
        })
      );
    }),
    deletes.length > 0
      ? deps.s3.deleteObjects({
          Bucket: bucket,
          Delete: {
            Objects: deletes.map(path => ({
              Key: legacyBaseImageKey(path)
            }))
          }
        })
      : Promise.resolve()
  ]);
}

function encodeS3CopySource(bucket: string, key: string): string {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
