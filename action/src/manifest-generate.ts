import { getInput, getMultilineInput } from '@actions/core';
import {
  NEW_IMAGES_DIRECTORY,
  ORIGINAL_NEW_IMAGES_DIRECTORY
} from 'shared/constants';
import { resizeImageIfNeeded } from './resize';
import { type Dependencies, makeDefaultDeps } from './dependencies';
import type { Manifest } from './manifest-s3';

export async function manifestGenerate(
  deps: Dependencies = makeDefaultDeps()
): Promise<void> {
  const visualTestCommands = getMultilineInput('visual-test-command');
  const commitHash = getInput('commit-hash');
  const bucket = getInput('bucket-name', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');
  const headSha = getInput('head-sha');
  const resizeWidth = getInput('resize-width');
  const resizeHeight = getInput('resize-height');
  const resizeEnabled = Boolean(resizeWidth || resizeHeight);

  const exitCodes = await Promise.all(
    visualTestCommands.map(cmd =>
      deps.exec(cmd, [], { ignoreReturnCode: true })
    )
  );
  if (exitCodes.some(code => code !== 0)) {
    deps.core.setFailed('Visual test command failed.');
    return;
  }

  const filePaths = await deps.glob(`${screenshotsDirectory}/**/*.png`, {
    nodir: true,
    absolute: false
  });

  const manifest: Manifest = {};
  for (const filePath of filePaths) {
    const relativePath = filePath.replace(`${screenshotsDirectory}/`, '');
    const hash = await deps.hashFile(filePath);
    manifest[relativePath] = hash;
  }

  const headManifest = headSha
    ? await fetchHeadManifest(deps, bucket, headSha)
    : null;

  const changedPaths = Object.keys(manifest).filter(
    p => !headManifest || headManifest[p] !== manifest[p]
  );

  deps.core.info(`${changedPaths.length} changed image(s) to upload.`);

  await Promise.all(
    changedPaths.map(async relativePath => {
      const localPath = `${screenshotsDirectory}/${relativePath}`;
      const fileBuffer = await deps.fs.readFile(localPath);

      if (resizeEnabled) {
        const resizedBuffer = await resizeImageIfNeeded(
          fileBuffer as Buffer,
          deps.jimp
        );
        await deps.s3.putObject({
          Bucket: bucket,
          Key: `${NEW_IMAGES_DIRECTORY}/${commitHash}/${relativePath}`,
          Body: resizedBuffer
        });
        await deps.s3.putObject({
          Bucket: bucket,
          Key: `${ORIGINAL_NEW_IMAGES_DIRECTORY}/${commitHash}/${relativePath}`,
          Body: fileBuffer
        });
      } else {
        await deps.s3.putObject({
          Bucket: bucket,
          Key: `${NEW_IMAGES_DIRECTORY}/${commitHash}/${relativePath}`,
          Body: fileBuffer
        });
      }
    })
  );

  await deps.s3.putObject({
    Bucket: bucket,
    Key: `manifests/${commitHash}.json`,
    Body: JSON.stringify(manifest),
    ContentType: 'application/json'
  });

  deps.core.info(
    `Manifest uploaded for ${commitHash} with ${Object.keys(manifest).length} entries.`
  );
}

async function fetchHeadManifest(
  deps: Pick<Dependencies, 's3'>,
  bucket: string,
  sha: string
): Promise<Manifest | null> {
  try {
    const response = await deps.s3.getObject({
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
