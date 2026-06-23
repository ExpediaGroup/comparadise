import { getInput, getMultilineInput } from '@actions/core';
import { NEW_IMAGES_DIRECTORY } from 'shared/constants';
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
  const packagePaths = getInput('package-paths')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);
  if (packagePaths.length > 1) {
    deps.core.setFailed(
      'manifest-generate expects a single package-paths value per matrix job; ' +
        `received ${packagePaths.length}: ${packagePaths.join(', ')}.`
    );
    return;
  }
  const packagePath = packagePaths[0] ?? '';

  const exitCodes = await Promise.all(
    visualTestCommands.map(cmd =>
      deps.exec(cmd, [], { ignoreReturnCode: true })
    )
  );
  if (exitCodes.some(code => code !== 0)) {
    deps.core.setFailed('Visual test command failed.');
    return;
  }

  const filePaths = await deps.glob(`${screenshotsDirectory}/**/new.png`, {
    nodir: true,
    absolute: false
  });

  // `localKey` is the path on disk relative to the screenshots root; for
  // monorepos `manifestKey` prefixes it with the package path so keys are
  // globally unique across parallel matrix jobs. Images and manifest entries
  // are keyed by `manifestKey`; only disk reads use `localKey`.
  const entries: { localKey: string; manifestKey: string; hash: string }[] = [];
  const manifest: Manifest = {};
  for (const filePath of filePaths) {
    const relativePath = filePath.replace(`${screenshotsDirectory}/`, '');
    const localKey = relativePath.replace(/\/new\.png$/, '');
    const manifestKey = packagePath ? `${packagePath}/${localKey}` : localKey;
    const hash = await deps.hashFile(filePath);
    manifest[manifestKey] = hash;
    entries.push({ localKey, manifestKey, hash });
  }

  const headManifest = headSha
    ? await fetchHeadManifest(deps, bucket, headSha)
    : null;

  const changedEntries = entries.filter(
    e => !headManifest || headManifest[e.manifestKey] !== e.hash
  );

  deps.core.info(`${changedEntries.length} changed image(s) to upload.`);

  await Promise.all(
    changedEntries.map(async ({ localKey, manifestKey }) => {
      const localPath = `${screenshotsDirectory}/${localKey}/new.png`;
      const fileBuffer = await deps.fs.readFile(localPath);
      const body = resizeEnabled
        ? await resizeImageIfNeeded(fileBuffer as Buffer, deps.jimp)
        : fileBuffer;
      await deps.s3.putObject({
        Bucket: bucket,
        Key: `${NEW_IMAGES_DIRECTORY}/${commitHash}/${manifestKey}/new.png`,
        Body: body
      });
    })
  );

  const manifestObjectKey = packagePath
    ? `manifests/${commitHash}/${packagePath}.json`
    : `manifests/${commitHash}.json`;
  await deps.s3.putObject({
    Bucket: bucket,
    Key: manifestObjectKey,
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
