import { getInput, info } from '@actions/core';
import {
  BASE_IMAGE_NAME,
  BASE_IMAGES_DIRECTORY,
  NEW_IMAGES_DIRECTORY,
  NEW_IMAGE_NAME,
  ORIGINAL_NEW_IMAGES_DIRECTORY
} from 'shared/constants';
import { map } from 'bluebird';
import * as path from 'path';
import { Readable } from 'stream';
import { resizeImageIfNeeded } from './resize';
import type { Deps } from './deps';

async function checkS3PrefixExists(
  bucketName: string,
  prefix: string,
  s3: Deps['s3']
): Promise<boolean> {
  try {
    const response = await s3.listObjects({
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: 1
    });
    return (response.Contents?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

async function downloadS3Directory(
  bucketName: string,
  s3Prefix: string,
  localDir: string,
  deps: Deps
): Promise<void> {
  info(`Downloading base images from s3://${bucketName}/${s3Prefix}`);

  const allObjects = await deps.s3.listAllObjects({
    Bucket: bucketName,
    Prefix: s3Prefix
  });
  const baseObjects = allObjects.filter(obj => obj.Key?.endsWith('base.png'));

  info(`Found ${baseObjects.length} base image(s) to download`);

  await map(baseObjects, async ({ Key }) => {
    if (!Key) return;

    const relativePath = Key.substring(s3Prefix.length);
    const localFilePath = path.join(localDir, relativePath);

    await deps.fs.mkdir(path.dirname(localFilePath), { recursive: true });

    const { Body } = await deps.s3.getObject({
      Bucket: bucketName,
      Key
    });
    if (Body instanceof Readable) {
      const writeStream = deps.fs.createWriteStream(localFilePath);
      await new Promise((resolve, reject) => {
        Body.pipe(writeStream).on('finish', resolve).on('error', reject);
      });
    }
  });

  info(`Downloaded ${baseObjects.length} base image(s) to ${localDir}`);
}

async function uploadLocalDirectoryWithResize(
  localDir: string,
  bucketName: string,
  s3Prefix: string,
  deps: Deps
): Promise<void> {
  const files = await deps.glob('**/{base,diff,new}.png', {
    cwd: localDir,
    nodir: true,
    absolute: false
  });

  const filesFromFailingTests = files.filter(file =>
    files.some(
      other =>
        path.dirname(other) === path.dirname(file) &&
        path.basename(other) === 'new.png'
    )
  );

  await map(filesFromFailingTests, async file => {
    const localFilePath = path.join(localDir, file);
    const s3Key = path.join(s3Prefix, file);

    const fileBuffer = await deps.fs.readFile(localFilePath);
    const resizedBuffer = await resizeImageIfNeeded(fileBuffer, deps.jimp);

    await deps.s3.putObject({
      Bucket: bucketName,
      Key: s3Key,
      Body: resizedBuffer
    });
  });

  if (filesFromFailingTests.length) {
    info(
      `Uploaded ${filesFromFailingTests.length} file(s) to s3://${bucketName}/${s3Prefix}`
    );
  }
}

async function uploadSingleFile(
  localFilePath: string,
  s3Key: string,
  deps: Deps
): Promise<void> {
  const bucketName = getInput('bucket-name', { required: true });
  const fileBuffer = await deps.fs.readFile(localFilePath);
  const resizedBuffer = await resizeImageIfNeeded(fileBuffer, deps.jimp);
  await deps.s3.putObject({
    Bucket: bucketName,
    Key: s3Key,
    Body: resizedBuffer
  });
  info(`Uploaded ${localFilePath} to s3://${bucketName}/${s3Key}`);
}

export const downloadBaseImages = async (deps: Deps) => {
  const bucketName = getInput('bucket-name', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');

  const prefixExists = await checkS3PrefixExists(
    bucketName,
    `${BASE_IMAGES_DIRECTORY}/`,
    deps.s3
  );

  if (!prefixExists) {
    info(
      `Base images directory does not exist in bucket ${bucketName}. Skipping download.`
    );
    await deps.fs.mkdir(screenshotsDirectory, { recursive: true });
    return;
  }

  const packagePaths = getInput('package-paths')?.split(',').filter(Boolean);
  if (packagePaths?.length) {
    return Promise.all(
      packagePaths.map(packagePath =>
        downloadS3Directory(
          bucketName,
          `${BASE_IMAGES_DIRECTORY}/${packagePath}/`,
          path.join(screenshotsDirectory, packagePath),
          deps
        )
      )
    );
  }

  return downloadS3Directory(
    bucketName,
    `${BASE_IMAGES_DIRECTORY}/`,
    screenshotsDirectory,
    deps
  );
};

export const uploadAllImages = async (hash: string, deps: Deps) => {
  const bucketName = getInput('bucket-name', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');
  const packagePaths = getInput('package-paths')?.split(',').filter(Boolean);

  if (packagePaths?.length) {
    return map(packagePaths, packagePath =>
      uploadLocalDirectoryWithResize(
        path.join(screenshotsDirectory, packagePath),
        bucketName,
        `${NEW_IMAGES_DIRECTORY}/${hash}/${packagePath}/`,
        deps
      )
    );
  }

  return uploadLocalDirectoryWithResize(
    screenshotsDirectory,
    bucketName,
    `${NEW_IMAGES_DIRECTORY}/${hash}/`,
    deps
  );
};

async function uploadOriginalNewPngs(
  localDir: string,
  bucketName: string,
  s3Prefix: string,
  deps: Deps
): Promise<void> {
  const files = await deps.glob('**/new.png', {
    cwd: localDir,
    nodir: true,
    absolute: false
  });
  await map(files, async file => {
    const localFilePath = path.join(localDir, file);
    const s3Key = path.join(s3Prefix, file);

    const fileBuffer = await deps.fs.readFile(localFilePath);

    await deps.s3.putObject({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileBuffer
    });
  });

  if (files.length) {
    info(
      `Uploaded ${files.length} original new.png file(s) to s3://${bucketName}/${s3Prefix}`
    );
  }
}

export const uploadOriginalNewImages = async (hash: string, deps: Deps) => {
  const resizeWidth = getInput('resize-width');
  const resizeHeight = getInput('resize-height');

  if (!resizeWidth && !resizeHeight) {
    return;
  }

  const bucketName = getInput('bucket-name', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');
  const packagePaths = getInput('package-paths')?.split(',').filter(Boolean);

  if (packagePaths?.length) {
    return map(packagePaths, packagePath =>
      uploadOriginalNewPngs(
        path.join(screenshotsDirectory, packagePath),
        bucketName,
        `${ORIGINAL_NEW_IMAGES_DIRECTORY}/${hash}/${packagePath}/`,
        deps
      )
    );
  }

  return uploadOriginalNewPngs(
    screenshotsDirectory,
    bucketName,
    `${ORIGINAL_NEW_IMAGES_DIRECTORY}/${hash}/`,
    deps
  );
};

export const deleteHashImages = async (hash: string, deps: Deps) => {
  const bucketName = getInput('bucket-name', { required: true });
  const packagePaths = getInput('package-paths')?.split(',').filter(Boolean);

  const [newImageKeys, originalImageKeys] = await Promise.all([
    deps.s3.getKeysFromS3(NEW_IMAGES_DIRECTORY, hash, bucketName),
    deps.s3.getKeysFromS3(ORIGINAL_NEW_IMAGES_DIRECTORY, hash, bucketName)
  ]);

  let keysToDelete = [...newImageKeys, ...originalImageKeys];

  if (packagePaths?.length) {
    const packagePrefixes = packagePaths.flatMap(packagePath => [
      `${NEW_IMAGES_DIRECTORY}/${hash}/${packagePath}/`,
      `${ORIGINAL_NEW_IMAGES_DIRECTORY}/${hash}/${packagePath}/`
    ]);
    keysToDelete = keysToDelete.filter(key =>
      packagePrefixes.some(prefix => key.startsWith(prefix))
    );
  }

  if (!keysToDelete.length) {
    info(`No images found in S3 for hash ${hash}. Skipping deletion.`);
    return;
  }

  await deps.s3.deleteObjects({
    Bucket: bucketName,
    Delete: {
      Objects: keysToDelete.map(Key => ({ Key })),
      Quiet: true
    }
  });

  info(`Deleted ${keysToDelete.length} image(s) for ${hash}`);
};

export const uploadBaseImages = async (newFilePaths: string[], deps: Deps) => {
  info(`Uploading ${newFilePaths.length} base image(s)`);
  return map(newFilePaths, newFilePath =>
    uploadSingleFile(newFilePath, buildBaseImagePath(newFilePath), deps)
  );
};

function buildBaseImagePath(newFilePath: string) {
  const screenshotsDirectory = getInput('screenshots-directory');
  return path.join(
    BASE_IMAGES_DIRECTORY,
    newFilePath
      .replace(screenshotsDirectory, '')
      .replace(`${NEW_IMAGE_NAME}.png`, `${BASE_IMAGE_NAME}.png`)
  );
}
