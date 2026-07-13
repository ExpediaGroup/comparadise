import { getInput, getMultilineInput } from '@actions/core';
import { context as githubContext } from '@actions/github';
import { NEW_IMAGES_DIRECTORY } from 'shared/constants';
import { resizeImageIfNeeded } from './resize';
import { type Dependencies, makeDefaultDeps } from './dependencies';
import { readBody, type Manifest } from './manifest-s3';
import { hashString } from './hash';

export async function manifestGenerate(
  deps: Dependencies = makeDefaultDeps()
): Promise<void> {
  const visualTestCommands = getMultilineInput('visual-test-command');
  const commitHash = getInput('commit-hash');
  const bucket = getInput('bucket-name', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');
  const resizeWidth = getInput('resize-width');
  const resizeHeight = getInput('resize-height');
  const resizeEnabled = Boolean(resizeWidth || resizeHeight);
  const packagePaths = getInput('package-paths')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

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

  // Each key is the screenshot directory's path relative to the screenshots
  // root. In a monorepo the test harness writes each package's screenshots
  // under a package-named subdirectory, so the relative path already begins
  // with the package path (e.g. `packages/ui/Button`) and is globally unique
  // across parallel matrix jobs — no prefix is added here.
  const entries: { key: string; hash: string }[] = [];
  const manifest: Manifest = {};
  for (const filePath of filePaths) {
    const relativePath = filePath.replace(`${screenshotsDirectory}/`, '');
    const key = relativePath.replace(/\/new\.png$/, '');
    const hash = await deps.hashFile(filePath);
    manifest[key] = hash;
    entries.push({ key, hash });
  }

  // Resolve the live base-branch HEAD (not the possibly-stale payload value)
  // to diff against for differential uploads. No base ref (non-PR trigger)
  // means no meaningful prior HEAD, so upload everything.
  const baseRef = githubContext.payload.pull_request?.base?.ref;
  const headSha = baseRef ? await resolveBaseHeadSha(deps, baseRef) : '';
  const headManifest = headSha
    ? await fetchHeadManifest(deps, bucket, headSha)
    : null;

  const changedEntries = entries.filter(
    e => !headManifest || headManifest[e.key] !== e.hash
  );

  deps.core.info(`${changedEntries.length} changed image(s) to upload.`);

  await Promise.all(
    changedEntries.map(async ({ key }) => {
      const localPath = `${screenshotsDirectory}/${key}/new.png`;
      const fileBuffer = await deps.fs.readFile(localPath);
      const body = resizeEnabled
        ? await resizeImageIfNeeded(fileBuffer as Buffer, deps.jimp)
        : fileBuffer;
      await deps.s3.putObject({
        Bucket: bucket,
        Key: `${NEW_IMAGES_DIRECTORY}/${commitHash}/${key}/new.png`,
        Body: body
      });
    })
  );

  const chunkId = chunkIdFor(packagePaths);
  const manifestObjectKey = chunkId
    ? `manifests/${commitHash}/${chunkId}.json`
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

// A chunk-id names the per-job manifest of a monorepo matrix run, where a
// single job may cover one or more packages (a "chunk"). It is the MD5 of the
// job's `package-paths` — trimmed and empties dropped at the call site, then
// sorted here so the same set of packages always hashes identically regardless
// of input order. An empty list (non-monorepo) yields no chunk-id, and the
// manifest is written to the flat `manifests/{sha}.json` instead.
function chunkIdFor(packagePaths: string[]): string {
  if (packagePaths.length === 0) return '';
  return hashString([...packagePaths].sort().join(','));
}

async function resolveBaseHeadSha(
  deps: Pick<Dependencies, 'octokit' | 'context'>,
  baseRef: string
): Promise<string> {
  const { data } = await deps.octokit.rest.repos.getBranch({
    ...deps.context.repo,
    branch: baseRef
  });
  return data.commit.sha;
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
    const body = await readBody(response);
    return JSON.parse(body) as Manifest;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}
