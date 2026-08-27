import { NEW_IMAGES_DIRECTORY } from 'shared/constants';
import type { Dependencies } from './dependencies';
import type { PrOwnsEntry } from './manifest-compare-classify';
import type { GetBaseImage } from './manifest-base-images';
import { readBodyBytes } from './manifest-s3';

export interface GenerateDiffsDeps {
  s3: Pick<Dependencies['s3'], 'getObject' | 'putObject'>;
  core: Pick<Dependencies['core'], 'info'>;
  diffPng: (base: Buffer, actual: Buffer) => Buffer;
  getBaseImage: GetBaseImage;
}

export interface GenerateDiffsParams {
  bucket: string;
  prSha: string;
  prOwns: PrOwnsEntry[];
}

export interface DiffOutcome {
  diffed: string[];
  identical: string[];
}

export async function generateDiffs(
  params: GenerateDiffsParams,
  deps: GenerateDiffsDeps
): Promise<DiffOutcome> {
  const { bucket, prSha, prOwns } = params;

  const changedEntries = prOwns.filter(e => e.type === 'changed');
  if (changedEntries.length === 0) return { diffed: [], identical: [] };

  deps.core.info(
    `Generating diffs for ${changedEntries.length} changed screenshot(s).`
  );

  const diffed: string[] = [];
  const identical: string[] = [];

  for (const entry of changedEntries) {
    const newKey = `${NEW_IMAGES_DIRECTORY}/${prSha}/${entry.path}/new.png`;

    // The base image is addressed by the hash the base branch recorded for
    // this path, so the comparison is against the image that entry actually
    // names — not whatever was last written to a shared per-path slot.
    const [base, newBuffer] = await Promise.all([
      deps.getBaseImage(bucket, entry.path, entry.baseHash),
      downloadBuffer(deps.s3, bucket, newKey)
    ]);
    const baseBuffer = base.buffer;

    if (baseBuffer.equals(newBuffer)) {
      identical.push(entry.path);
      continue;
    }

    const diffBuffer = deps.diffPng(baseBuffer, newBuffer);

    await Promise.all([
      deps.s3.putObject({
        Bucket: bucket,
        Key: `${NEW_IMAGES_DIRECTORY}/${prSha}/${entry.path}/base.png`,
        Body: baseBuffer
      }),
      deps.s3.putObject({
        Bucket: bucket,
        Key: `${NEW_IMAGES_DIRECTORY}/${prSha}/${entry.path}/diff.png`,
        Body: diffBuffer
      })
    ]);

    diffed.push(entry.path);
  }

  return { diffed, identical };
}

async function downloadBuffer(
  s3: GenerateDiffsDeps['s3'],
  bucket: string,
  key: string
): Promise<Buffer> {
  const response = await s3.getObject({ Bucket: bucket, Key: key });
  const bytes = await readBodyBytes(response);
  return Buffer.from(bytes);
}
