import { exec } from '@actions/exec';
import { getInput } from '@actions/core';

export const downloadBaseImages = async () => {
  const bucketName = getInput('bucket-name', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');
  const baseImagesDirectory = getInput('base-images-directory');
  const packagePaths = getInput('package-paths')?.split(',');
  if (packagePaths) {
    return Promise.all(
      packagePaths.map(packagePath =>
        exec(`aws s3 cp s3://${bucketName}/${baseImagesDirectory}/${packagePath} ${screenshotsDirectory}/${packagePath} --recursive`)
      )
    );
  }

  return exec(`aws s3 cp s3://${bucketName}/${baseImagesDirectory} ${screenshotsDirectory} --recursive`);
};

export const uploadBaseImages = async () => {
  const bucketName = getInput('bucket-name', { required: true });
  const screenshotsDirectory = getInput('screenshots-directory');
  const commitHash = getInput('commit-hash', { required: true });
  const packagePaths = getInput('package-paths')?.split(',');
  if (packagePaths) {
    return Promise.all(
      packagePaths.map(packagePath =>
        exec(`aws s3 cp ${screenshotsDirectory}/${packagePath} s3://${bucketName}/${commitHash}/${packagePath} --recursive`)
      )
    );
  }

  return exec(`aws s3 cp ${screenshotsDirectory} s3://${bucketName}/${commitHash} --recursive`);
};
