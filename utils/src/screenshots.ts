import * as fs from 'fs';
import { PNG } from 'pngjs';
import { getDiffPixels } from './images';
import { createImageFileName } from './files';

export function baseExists(path: string) {
  const fileName = createImageFileName(path, 'base');
  const exists = fs.existsSync(fileName);

  if (!exists) {
    console.log('Base image does not exist. This means a new one will be created. If your base should exist, something went wrong.');
  }
  return exists;
}

export function createNewScreenshot(screenshotFolder: string) {
  const newImage = PNG.sync.read(fs.readFileSync(createImageFileName(screenshotFolder, 'new')));
  fs.writeFile(createImageFileName(screenshotFolder, 'new'), PNG.sync.write(newImage), err => {
    if (err) {
      console.error('❌Unable to create new.png', err);
    }
  });

  return null;
}

export function compareScreenshots(screenshotFolder: string) {
  const basePath = createImageFileName(screenshotFolder, 'base');
  const actualPath = createImageFileName(screenshotFolder, 'new');
  const { diffPixels, diff } = getDiffPixels(basePath, actualPath);

  if (diffPixels) {
    // Create diff.png next to base and new for review
    fs.writeFile(createImageFileName(screenshotFolder, 'diff'), PNG.sync.write(diff), err => {
      if (err) {
        console.error('❌Diff exists but unable to create diff.png', err);
      }
    });
  } else {
    // Delete created new.png. Not needed if there's no diff
    fs.unlink(actualPath, err => {
      if (err) {
        console.error('❌No diff but unable to deleteactualPath}', err);
      }
    });
  }

  return diffPixels;
}
