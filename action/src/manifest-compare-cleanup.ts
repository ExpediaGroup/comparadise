import { NEW_IMAGES_DIRECTORY } from 'shared/constants';
import type { Dependencies } from './dependencies';

export interface CleanupOrphanedNewImagesDeps {
  s3: Pick<Dependencies['s3'], 'listAllObjects' | 'deleteObjects'>;
  core: Pick<Dependencies['core'], 'info'>;
}

const DELETE_BATCH_SIZE = 1000;

/**
 * Delete uploaded images under new-images/{prSha}/ for screenshot paths that
 * are not part of the final review set.
 *
 * manifest-generate uploads a new.png for every screenshot whose hash differs
 * from the base branch's manifest at generate time, but compare may later
 * exclude some of those paths from review — they can be visually identical to
 * their base image (hash noise), owned by main, or stale from a prior run of
 * the same commit. The Comparadise UI lists everything under the hash prefix,
 * so leftover files show up as spurious "new" screenshots unless removed.
 */
export async function cleanupOrphanedNewImages(
  bucket: string,
  prSha: string,
  keepPaths: string[],
  deps: CleanupOrphanedNewImagesDeps
): Promise<void> {
  const prefix = `${NEW_IMAGES_DIRECTORY}/${prSha}/`;
  const objects = await deps.s3.listAllObjects({
    Bucket: bucket,
    Prefix: prefix
  });

  const keep = new Set(keepPaths);
  const orphanedKeys = objects
    .map(object => object.Key)
    .filter((key): key is string => Boolean(key))
    .filter(key => {
      const screenshotPath = key.slice(prefix.length, key.lastIndexOf('/'));
      return !keep.has(screenshotPath);
    });

  if (orphanedKeys.length === 0) return;

  deps.core.info(
    `Deleting ${orphanedKeys.length} uploaded image file(s) for paths outside the review set.`
  );

  for (let i = 0; i < orphanedKeys.length; i += DELETE_BATCH_SIZE) {
    await deps.s3.deleteObjects({
      Bucket: bucket,
      Delete: {
        Objects: orphanedKeys
          .slice(i, i + DELETE_BATCH_SIZE)
          .map(Key => ({ Key }))
      }
    });
  }
}
