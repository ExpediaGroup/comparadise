import { info, getInput } from '@actions/core';
import { exec } from '@actions/exec';

const post = async () => {
  info('Cleaning up screenshots directory...');

  const screenshotsDirectory = getInput('screenshots-directory');

  await exec(`rm -rf ${screenshotsDirectory}`);

  info('Cleanup complete!');
};

post().catch(error => {
  console.error('Post step failed:', error);
});
