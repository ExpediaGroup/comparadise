import { info, getInput } from '@actions/core';
import { rm } from 'fs/promises';

const post = async () => {
  info('Cleaning up screenshots directory...');

  const screenshotsDirectory = getInput('screenshots-directory');

  try {
    await rm(screenshotsDirectory, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, which is fine
    info(`Could not remove directory: ${error}`);
  }

  info('Cleanup complete!');
};

post().catch(error => {
  console.error('Post step failed:', error);
});
