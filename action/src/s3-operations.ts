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
import { sync as globSync } from 'glob';
import { Readable } from 'stream';

const s3Client = new S3Client();

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
  info(`Downloading screenshots from s3://${bucketName}/${s3Prefix}`);

  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: s3Prefix
  });

  const response = await s3Client.send(command);
  const objects = response.Contents ?? [];

  info(`Found ${objects.length} file(s) to download`);

  await map(objects, async object => {
    if (!object.Key) return;

    const relativePath = object.Key.substring(s3Prefix.length);
    const localFilePath = path.join(localDir, relativePath);

    await fsPromises.mkdir(path.dirname(localFilePath), { recursive: true });

    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: object.Key
    });

    const { Body } = await s3Client.send(getCommand);
    if (Body instanceof Readable) {
      const writeStream = fs.createWriteStream(localFilePath);
      await new Promise((resolve, reject) => {
        Body.pipe(writeStream).on('finish', resolve).on('error', reject);
      });
    }
  });

  info(`Downloaded ${objects.length} file(s) to ${localDir}`);
}

async function uploadLocalDirectory(
  localDir: string,
  bucketName: string,
  s3Prefix: string
): Promise<void> {
  const files = globSync('**/*.png', {
    cwd: localDir,
    nodir: true,
    absolute: false
  });

  info(
    `Uploading ${files.length} file(s) from ${localDir} to s3://${bucketName}/${s3Prefix}`
  );

  await map(files, async file => {
    const localFilePath = path.join(localDir, file);
    const s3Key = path.join(s3Prefix, file);

    const fileContent = await fsPromises.readFile(localFilePath);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent
    });

    await s3Client.send(command);
  });

  info(`Uploaded ${files.length} file(s) to s3://${bucketName}/${s3Prefix}`);
}

async function uploadSingleFile(
  localFilePath: string,
  bucketName: string,
  s3Key: string
): Promise<void> {
  const fileContent = await fsPromises.readFile(localFilePath);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: fileContent
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

  const packagePaths = getInput('package-paths')?.split(',');
  if (packagePaths) {
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
  const packagePaths = getInput('package-paths')?.split(',');

  if (packagePaths) {
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
  const bucketName = getInput('bucket-name', { required: true });
  info(`Uploading ${newFilePaths.length} base image(s)`);
  return map(newFilePaths, newFilePath =>
    uploadSingleFile(newFilePath, bucketName, buildBaseImagePath(newFilePath))
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
