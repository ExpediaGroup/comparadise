import { exec } from '@actions/exec';
import { getInput } from '@actions/core';
import {
  BASE_IMAGE_NAME,
  BASE_IMAGES_DIRECTORY,
  NEW_IMAGES_DIRECTORY,
  NEW_IMAGE_NAME
} from 'shared';
import { map } from 'bluebird';
import * as path from 'path';

export const downloadBaseImages = async () => {
  const bucketName = getInput('bucket-name', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');
  const packagePaths = getInput('package-paths')?.split(',');
  if (packagePaths) {
    return Promise.all(
      packagePaths.map(packagePath =>
        exec(
          `aws s3 cp s3://${bucketName}/${BASE_IMAGES_DIRECTORY}/${packagePath} ${screenshotsDirectory}/${packagePath} --recursive`
        )
      )
    );
  }

  return exec(
    `aws s3 cp s3://${bucketName}/${BASE_IMAGES_DIRECTORY} ${screenshotsDirectory} --recursive`
  );
};

export const uploadAllImages = async (hash: string) => {
  const bucketName = getInput('bucket-name', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');
  const packagePaths = getInput('package-paths')?.split(',');
  if (packagePaths) {
    return map(packagePaths, packagePath =>
      exec(
        `aws s3 cp ${screenshotsDirectory}/${packagePath} s3://${bucketName}/${NEW_IMAGES_DIRECTORY}/${hash}/${packagePath} --recursive`
      )
    );
  }

  return exec(
    `aws s3 cp ${screenshotsDirectory} s3://${bucketName}/${NEW_IMAGES_DIRECTORY}/${hash} --recursive`
  );
};

export const uploadBaseImages = async (newFilePaths: string[]) => {
  const bucketName = getInput('bucket-name', { required: true });
  return map(newFilePaths, newFilePath =>
    exec(
      `aws s3 cp ${newFilePath} s3://${bucketName}/${buildBaseImagePath(newFilePath)}`
    )
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
