import { BASE_IMAGES_DIRECTORY, NEW_IMAGES_DIRECTORY } from 'shared/constants';
import type { Dependencies } from './dependencies';
import type { PrOwnsEntry } from './manifest-compare-classify';

export interface GenerateDiffsDeps {
  s3: Pick<Dependencies['s3'], 'getObject' | 'putObject'>;
  core: Pick<Dependencies['core'], 'info'>;
  diffPng: (base: Buffer, actual: Buffer) => Buffer;
}

export interface GenerateDiffsParams {
  bucket: string;
  prSha: string;
  prOwns: PrOwnsEntry[];
}

export async function generateDiffs(
  params: GenerateDiffsParams,
  deps: GenerateDiffsDeps
): Promise<void> {
  const { bucket, prSha, prOwns } = params;

  const changedEntries = prOwns.filter(e => e.type === 'changed');
  if (changedEntries.length === 0) return;

  deps.core.info(
    `Generating diffs for ${changedEntries.length} changed screenshot(s).`
  );

  for (const entry of changedEntries) {
    const baseKey = `${BASE_IMAGES_DIRECTORY}/${entry.path}/base.png`;
    const newKey = `${NEW_IMAGES_DIRECTORY}/${prSha}/${entry.path}/new.png`;

    const [baseBuffer, newBuffer] = await Promise.all([
      downloadBuffer(deps.s3, bucket, baseKey),
      downloadBuffer(deps.s3, bucket, newKey)
    ]);

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
  }
}

async function downloadBuffer(
  s3: GenerateDiffsDeps['s3'],
  bucket: string,
  key: string
): Promise<Buffer> {
  const response = await s3.getObject({ Bucket: bucket, Key: key });
  const bytes = await response.Body!.transformToByteArray();
  return Buffer.from(bytes);
}
