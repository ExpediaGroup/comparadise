import { info } from '@actions/core';
import { PNG } from 'pngjs';
import { Readable } from 'stream';
import { getKeysFromS3, getObject, putObject } from 'shared/s3';
import { NEW_IMAGES_DIRECTORY } from 'shared/constants';
import { getDiffPixels } from 'shared/images';

export interface MergeQueueDiffResult {
  intersectionCount: number;
  diffCount: number;
}

async function readS3Buffer(bucket: string, key: string): Promise<Buffer> {
  const { Body } = await getObject({ Bucket: bucket, Key: key });
  if (!Body) throw new Error(`Empty body for S3 key: ${key}`);
  const chunks: Buffer[] = [];
  for await (const chunk of Body as Readable) {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    );
  }
  return Buffer.concat(chunks);
}

function testDirFromKey(key: string, sha: string): string {
  // key: new-images/{sha}/{testDir}/new.png
  const prefix = `${NEW_IMAGES_DIRECTORY}/${sha}/`;
  return key.slice(prefix.length, key.lastIndexOf('/'));
}

export async function computeMergeQueueDiffs(
  headSha: string,
  baseSha: string,
  bucketName: string
): Promise<MergeQueueDiffResult> {
  const [headKeys, baseKeys] = await Promise.all([
    getKeysFromS3(NEW_IMAGES_DIRECTORY, headSha, bucketName),
    getKeysFromS3(NEW_IMAGES_DIRECTORY, baseSha, bucketName)
  ]);

  const headNewKeys = headKeys.filter(k => k.endsWith('/new.png'));
  const baseNewKeys = baseKeys.filter(k => k.endsWith('/new.png'));

  const headDirs = new Set(headNewKeys.map(k => testDirFromKey(k, headSha)));
  const baseDirToKey = new Map(
    baseNewKeys.map(k => [testDirFromKey(k, baseSha), k])
  );

  const intersection = [...headDirs].filter(dir => baseDirToKey.has(dir));

  info(
    `Merge queue diff: ${intersection.length} test(s) in intersection of head and base.`
  );

  let diffCount = 0;

  await Promise.all(
    intersection.map(async testDir => {
      const headKey = `${NEW_IMAGES_DIRECTORY}/${headSha}/${testDir}/new.png`;
      const baseKey = baseDirToKey.get(testDir)!;

      const [headBuf, baseBuf] = await Promise.all([
        readS3Buffer(bucketName, headKey),
        readS3Buffer(bucketName, baseKey)
      ]);

      const { diffPixels, diff } = getDiffPixels(baseBuf, headBuf);

      if (diffPixels > 0) diffCount++;

      await Promise.all([
        putObject({
          Bucket: bucketName,
          Key: `${NEW_IMAGES_DIRECTORY}/${headSha}/${testDir}/base.png`,
          Body: baseBuf
        }),
        putObject({
          Bucket: bucketName,
          Key: `${NEW_IMAGES_DIRECTORY}/${headSha}/${testDir}/diff.png`,
          Body: PNG.sync.write(diff)
        })
      ]);
    })
  );

  info(`Merge queue diff: ${diffCount} test(s) with pixel differences.`);
  return { intersectionCount: intersection.length, diffCount };
}
