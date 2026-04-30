import { getInput, info } from '@actions/core';
import {
  BASE_IMAGE_NAME,
  BASE_IMAGES_DIRECTORY,
  NEW_IMAGES_DIRECTORY,
  NEW_IMAGE_NAME,
  ORIGINAL_NEW_IMAGES_DIRECTORY
} from 'shared/constants';
import {
  deleteObjects,
  getKeysFromS3,
  getObject,
  listAllObjects,
  listObjects,
  putObject
} from 'shared/s3';
import { map } from 'bluebird';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { glob } from 'glob';
import { Readable } from 'stream';
import { resizeImageIfNeeded } from './resize';

async function checkS3PrefixExists(
  bucketName: string,
  prefix: string
): Promise<boolean> {
  try {
    const response = await listObjects({
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
  localDir: string
): Promise<void> {
  info(`Downloading base images from s3://${bucketName}/${s3Prefix}`);

  const allObjects = await listAllObjects({
    Bucket: bucketName,
    Prefix: s3Prefix
  });
  const baseObjects = allObjects.filter(obj => obj.Key?.endsWith('base.png'));

  info(`Found ${baseObjects.length} base image(s) to download`);

  await map(baseObjects, async ({ Key }) => {
    if (!Key) return;

    const relativePath = Key.substring(s3Prefix.length);
    const localFilePath = path.join(localDir, relativePath);

    await fsPromises.mkdir(path.dirname(localFilePath), { recursive: true });

    const { Body } = await getObject({
      Bucket: bucketName,
      Key
    });
    if (Body instanceof Readable) {
      const writeStream = fs.createWriteStream(localFilePath);
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
  s3Prefix: string
): Promise<void> {
  const files = await glob('**/{base,diff,new}.png', {
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

    const fileBuffer = await fsPromises.readFile(localFilePath);
    const resizedBuffer = await resizeImageIfNeeded(fileBuffer);

    await putObject({
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
  s3Key: string
): Promise<void> {
  const bucketName = getInput('bucket-name', { required: true });
  const fileBuffer = await fsPromises.readFile(localFilePath);
  const resizedBuffer = await resizeImageIfNeeded(fileBuffer);
  await putObject({
    Bucket: bucketName,
    Key: s3Key,
    Body: resizedBuffer
  });
  info(`Uploaded ${localFilePath} to s3://${bucketName}/${s3Key}`);
}

export const downloadBaseImages = async () => {
  const bucketName = getInput('bucket-name', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');

  const prefixExists = await checkS3PrefixExists(
    bucketName,
    `${BASE_IMAGES_DIRECTORY}/`
  );

  if (!prefixExists) {
    info(
      `Base images directory does not exist in bucket ${bucketName}. Skipping download.`
    );
    await fsPromises.mkdir(screenshotsDirectory, { recursive: true });
    return;
  }

  const packagePaths = getInput('package-paths')?.split(',').filter(Boolean);
  if (packagePaths?.length) {
    return Promise.all(
      packagePaths.map(packagePath =>
        downloadS3Directory(
          bucketName,
          `${BASE_IMAGES_DIRECTORY}/${packagePath}/`,
          path.join(screenshotsDirectory, packagePath)
        )
      )
    );
  }

  return downloadS3Directory(
    bucketName,
    `${BASE_IMAGES_DIRECTORY}/`,
    screenshotsDirectory
  );
};

export const uploadAllImages = async (hash: string) => {
  const bucketName = getInput('bucket-name', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');
  const packagePaths = getInput('package-paths')?.split(',').filter(Boolean);

  if (packagePaths?.length) {
    return map(packagePaths, packagePath =>
      uploadLocalDirectoryWithResize(
        path.join(screenshotsDirectory, packagePath),
        bucketName,
        `${NEW_IMAGES_DIRECTORY}/${hash}/${packagePath}/`
      )
    );
  }

  return uploadLocalDirectoryWithResize(
    screenshotsDirectory,
    bucketName,
    `${NEW_IMAGES_DIRECTORY}/${hash}/`
  );
};

async function uploadOriginalNewPngs(
  localDir: string,
  bucketName: string,
  s3Prefix: string
): Promise<void> {
  const files = await glob('**/new.png', {
    cwd: localDir,
    nodir: true,
    absolute: false
  });
  await map(files, async file => {
    const localFilePath = path.join(localDir, file);
    const s3Key = path.join(s3Prefix, file);

    const fileBuffer = await fsPromises.readFile(localFilePath);

    await putObject({
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

export const uploadOriginalNewImages = async (hash: string) => {
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
        `${ORIGINAL_NEW_IMAGES_DIRECTORY}/${hash}/${packagePath}/`
      )
    );
  }

  return uploadOriginalNewPngs(
    screenshotsDirectory,
    bucketName,
    `${ORIGINAL_NEW_IMAGES_DIRECTORY}/${hash}/`
  );
};

export const deleteHashImages = async (hash: string) => {
  const bucketName = getInput('bucket-name', { required: true });
  const packagePaths = getInput('package-paths')?.split(',').filter(Boolean);

  const [newImageKeys, originalImageKeys] = await Promise.all([
    getKeysFromS3(NEW_IMAGES_DIRECTORY, hash, bucketName),
    getKeysFromS3(ORIGINAL_NEW_IMAGES_DIRECTORY, hash, bucketName)
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

  await deleteObjects({
    Bucket: bucketName,
    Delete: {
      Objects: keysToDelete.map(Key => ({ Key })),
      Quiet: true
    }
  });

  info(`Deleted ${keysToDelete.length} image(s) for ${hash}`);
};

export const uploadBaseImages = async (newFilePaths: string[]) => {
  info(`Uploading ${newFilePaths.length} base image(s)`);
  return map(newFilePaths, newFilePath =>
    uploadSingleFile(newFilePath, buildBaseImagePath(newFilePath))
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
