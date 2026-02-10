import { info, getInput } from '@actions/core';
import { rm } from 'fs/promises';
import { glob } from 'glob';
import { map } from 'bluebird';

const post = async () => {
  info('Cleaning up PNG files in screenshots directory...');

  const screenshotsDirectory = getInput('screenshots-directory');

  try {
    const pngFiles = await glob(`${screenshotsDirectory}/**/*.png`);
    await map(pngFiles, file => rm(file, { force: true }));

    info(`Removed ${pngFiles.length} PNG file(s) from ${screenshotsDirectory}`);
  } catch (error) {
    // Directory might not exist, which is fine
    info(`Could not clean up PNG files: ${error}`);
  }

  info('Cleanup complete!');
};

post().catch(error => {
  console.error('Post step failed:', error);
});
