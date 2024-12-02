import * as fs from 'fs';
import { PNG } from 'pngjs';
import { getDiffPixels } from './images';
import { createImageFileName } from './files';

/**
 * Checks if a base image exists
 * @param path - Folder path where you can find the base.png image
 * @returns true if path/base.png exists, false if not.
 */
export function baseExists(path: string) {
  const fileName = createImageFileName(path, 'base');
  console.log('Checking if base image exists at:', fileName);
  const exists = fs.existsSync(fileName);

  if (!exists) {
    console.log(
      'Base image does not exist. This means a new one will be created. If your base should exist, something went wrong.'
    );
  }
  return exists;
}

/**
 * Runs a visual regression test.
 * @param screenshotFolder - Full screenshots folder where the base/new/diff
 *                           images will be compared and written to.
 */
export function compareScreenshots(screenshotFolder: string) {
  const basePath = createImageFileName(screenshotFolder, 'base');
  const actualPath = createImageFileName(screenshotFolder, 'new');
  const { diffPixels, diff } = getDiffPixels(basePath, actualPath);

  if (diffPixels) {
    // Create diff.png next to base and new for review
    fs.writeFile(
      createImageFileName(screenshotFolder, 'diff'),
      new Uint8Array(PNG.sync.write(diff)),
      err => {
        if (err) {
          console.error('❌ Diff exists but unable to create diff.png', err);
        }
      }
    );
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

const trimPostfix = (path: string) => {
  const imgExt = '.png';
  const attemptPostfixRegex = new RegExp(`\\s\\(attempt \\d+\\)${imgExt}$`);

  if (attemptPostfixRegex.test(path)) {
    return path.replace(attemptPostfixRegex, imgExt);
  }

  return path;
};

const getNewPath = (path: string) => {
  let newPath;
  if (path.includes('___')) {
    newPath = path.slice(path.lastIndexOf('___') + 3);
    if (newPath.startsWith('/')) {
      newPath = `.${newPath}`;
    }
    console.log(newPath);
  } else {
    newPath = path;
  }

  return trimPostfix(newPath);
};

/**
 * Renames all root cypress screenshots to where the test was actually run.
 * Should NOT be used standalone. Works with the matchScreenshot task.
 * @param {Cypress.ScreenshotDetails} details
 */
export function onAfterScreenshot(
  details: Cypress.ScreenshotDetails
): Promise<Cypress.AfterScreenshotReturnObject> {
  console.log('🧸 Screenshot was saved to:', details.path);
  if (!details.path.match('cypress')) {
    return Promise.resolve({});
  }

  const newPath = getNewPath(details.path);
  const newPathDir = newPath.substring(0, newPath.lastIndexOf('/'));

  try {
    fs.mkdirSync(newPathDir, { recursive: true });
  } catch (err) {
    console.error('❌ Error creating new screenshot folder:', newPathDir, err);
  }

  return new Promise((resolve, reject) => {
    fs.rename(details.path, newPath, err => {
      if (err) {
        reject(err);
      }

      // because we renamed/moved the image, resolve with the new path
      // so it is accurate in the test results
      resolve({ path: newPath });
    });
  });
}
