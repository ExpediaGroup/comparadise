import { getInput, info } from '@actions/core';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3';
import {
  BASE_IMAGE_NAME,
  BASE_IMAGES_DIRECTORY,
  NEW_IMAGES_DIRECTORY,
  NEW_IMAGE_NAME
} from 'shared';
import { map } from 'bluebird';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { glob } from 'glob';
import { Readable } from 'stream';
import { Jimp } from 'jimp';

const s3Client = new S3Client();

async function resizeImageIfNeeded(buffer: Buffer): Promise<Buffer> {
  const resizeWidth = getInput('resize-width');
  const resizeHeight = getInput('resize-height');

  if (!resizeWidth && !resizeHeight) {
    return buffer;
  }
  const width = resizeWidth ? Number(resizeWidth) : undefined;
  const height = resizeHeight ? Number(resizeHeight) : undefined;
  if ((width && isNaN(width)) || (height && isNaN(height))) {
    throw new Error('resize-width and resize-height must be valid numbers');
  }

  const image = await Jimp.read(buffer);
  if (width && height) {
    image.contain({ w: width, h: height });
  } else if (width) {
    image.resize({ w: width });
  } else if (height) {
    image.resize({ h: height });
  }

  return image.getBuffer('image/png');
}

async function checkS3PrefixExists(
  bucketName: string,
  prefix: string
): Promise<boolean> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: 1
    });
    const response = await s3Client.send(command);
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

  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: s3Prefix
  });

  const response = await s3Client.send(command);
  const allObjects = response.Contents ?? [];
  const baseObjects = allObjects.filter(obj => obj.Key?.endsWith('base.png'));

  info(`Found ${baseObjects.length} base image(s) to download`);

  await map(baseObjects, async ({ Key }) => {
    if (!Key) return;

    const relativePath = Key.substring(s3Prefix.length);
    const localFilePath = path.join(localDir, relativePath);

    await fsPromises.mkdir(path.dirname(localFilePath), { recursive: true });

    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key
    });

    const { Body } = await s3Client.send(getCommand);
    if (Body instanceof Readable) {
      const writeStream = fs.createWriteStream(localFilePath);
      await new Promise((resolve, reject) => {
        Body.pipe(writeStream).on('finish', resolve).on('error', reject);
      });
    }
  });

  info(`Downloaded ${baseObjects.length} base image(s) to ${localDir}`);
}

async function uploadLocalDirectory(
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

  info(
    `Uploading ${filesFromFailingTests.length} file(s) from ${localDir} to s3://${bucketName}/${s3Prefix}`
  );

  await map(filesFromFailingTests, async file => {
    const localFilePath = path.join(localDir, file);
    const s3Key = path.join(s3Prefix, file);

    const fileBuffer = await fsPromises.readFile(localFilePath);
    const resizedBuffer = await resizeImageIfNeeded(fileBuffer);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: resizedBuffer
    });

    await s3Client.send(command);
  });

  info(
    `Uploaded ${filesFromFailingTests.length} file(s) to s3://${bucketName}/${s3Prefix}`
  );
}

async function uploadSingleFile(
  localFilePath: string,
  s3Key: string
): Promise<void> {
  const bucketName = getInput('bucket-name', { required: true });
  const fileBuffer = await fsPromises.readFile(localFilePath);
  const resizedBuffer = await resizeImageIfNeeded(fileBuffer);
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: resizedBuffer
  });

  await s3Client.send(command);
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
      uploadLocalDirectory(
        path.join(screenshotsDirectory, packagePath),
        bucketName,
        `${NEW_IMAGES_DIRECTORY}/${hash}/${packagePath}/`
      )
    );
  }

  return uploadLocalDirectory(
    screenshotsDirectory,
    bucketName,
    `${NEW_IMAGES_DIRECTORY}/${hash}/`
  );
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
