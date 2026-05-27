import { getInput, getMultilineInput, info, setFailed } from '@actions/core';
import { exec } from '@actions/exec';
import { glob } from 'glob';
import { hashFile as defaultHashFile } from './hash';
import { readImageFile as defaultReadImageFile } from './read-image-file';
import { resizeImageIfNeeded as defaultResizeImageIfNeeded } from './resize';
import { putObject, getObject } from 'shared/s3';
import {
  NEW_IMAGES_DIRECTORY,
  ORIGINAL_NEW_IMAGES_DIRECTORY
} from 'shared/constants';
import type { Manifest } from './manifest-s3';

export interface ManifestGenerateDeps {
  hashFile: (path: string) => Promise<string>;
  readImageFile: (path: string) => Promise<Buffer>;
  resizeImageIfNeeded: (buffer: Buffer) => Promise<Buffer>;
  exec: (
    cmd: string,
    args: string[],
    opts: { ignoreReturnCode: boolean }
  ) => Promise<number>;
  glob: (
    pattern: string,
    opts: { nodir: boolean; absolute: boolean }
  ) => Promise<string[]>;
  getInput: (name: string, opts?: { required?: boolean }) => string;
  getMultilineInput: (name: string) => string[];
  info: (msg: string) => void;
  setFailed: (msg: string) => void;
  putObject: typeof putObject;
  getObject: typeof getObject;
}

const defaultDeps: ManifestGenerateDeps = {
  hashFile: defaultHashFile,
  readImageFile: defaultReadImageFile,
  resizeImageIfNeeded: defaultResizeImageIfNeeded,
  exec,
  glob,
  getInput,
  getMultilineInput,
  info,
  setFailed,
  putObject,
  getObject
};

export async function manifestGenerate(
  deps: ManifestGenerateDeps = defaultDeps
): Promise<void> {
  const visualTestCommands = deps.getMultilineInput('visual-test-command');
  const commitHash = deps.getInput('commit-hash');
  const bucket = deps.getInput('bucket-name', { required: true });
  const screenshotsDirectory = deps.getInput('screenshots-directory');
  const headSha = deps.getInput('head-sha');
  const resizeWidth = deps.getInput('resize-width');
  const resizeHeight = deps.getInput('resize-height');
  const resizeEnabled = Boolean(resizeWidth || resizeHeight);

  const exitCodes = await Promise.all(
    visualTestCommands.map(cmd =>
      deps.exec(cmd, [], { ignoreReturnCode: true })
    )
  );
  if (exitCodes.some(code => code !== 0)) {
    deps.setFailed('Visual test command failed.');
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

  deps.info(`${changedPaths.length} changed image(s) to upload.`);

  await Promise.all(
    changedPaths.map(async relativePath => {
      const localPath = `${screenshotsDirectory}/${relativePath}`;
      const fileBuffer = await deps.readImageFile(localPath);

      if (resizeEnabled) {
        const resizedBuffer = await deps.resizeImageIfNeeded(fileBuffer);
        await deps.putObject({
          Bucket: bucket,
          Key: `${NEW_IMAGES_DIRECTORY}/${commitHash}/${relativePath}`,
          Body: resizedBuffer
        });
        await deps.putObject({
          Bucket: bucket,
          Key: `${ORIGINAL_NEW_IMAGES_DIRECTORY}/${commitHash}/${relativePath}`,
          Body: fileBuffer
        });
      } else {
        await deps.putObject({
          Bucket: bucket,
          Key: `${NEW_IMAGES_DIRECTORY}/${commitHash}/${relativePath}`,
          Body: fileBuffer
        });
      }
    })
  );

  await deps.putObject({
    Bucket: bucket,
    Key: `manifests/${commitHash}.json`,
    Body: JSON.stringify(manifest),
    ContentType: 'application/json'
  });

  deps.info(
    `Manifest uploaded for ${commitHash} with ${Object.keys(manifest).length} entries.`
  );
}

async function fetchHeadManifest(
  deps: Pick<ManifestGenerateDeps, 'getObject'>,
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
