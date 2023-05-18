import * as fs from 'fs';
import path, { join } from 'path';
import { PNG } from 'pngjs';
import { getDiffPixels } from './images';

export function baseExists(screenshotFolder: string) {
  const fileName = join(screenshotFolder, 'base.png');
  const exists = fs.existsSync(fileName);

  if (!exists) {
    console.log('Base image does not exist. This means a new one will be created. If your base should exist, something went wrong.');
  }
  return exists;
}

export function compareScreenshots(screenshotFolder: string) {
  const basePath = join(screenshotFolder, 'base.png');
  const actualPath = join(screenshotFolder, 'new.png');
  const { diffPixels, diff } = getDiffPixels(basePath, actualPath);

  if (diffPixels) {
    // Create diff.png next to base and new for review
    fs.writeFile(join(screenshotFolder, 'diff.png'), PNG.sync.write(diff), err => {
      if (err) {
        console.error('❌ Diff exists but unable to create diff.png', err);
      }
    });
  } else {
    // Delete created new.png. Not needed if there's no diff
    fs.unlink(actualPath, err => {
      if (err) {
        console.error('❌ No diff but unable to delete actualPath}', err);
      }
    });
  }

  return diffPixels;
}
