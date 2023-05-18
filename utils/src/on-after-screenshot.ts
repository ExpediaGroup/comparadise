import * as fs from 'fs';

export function onAfterScreenshot(details: Cypress.ScreenshotDetails): Promise<Cypress.AfterScreenshotReturnObject> {
  console.log('🧸 Screenshot was saved to:', details.path);
  if (!details.specName.includes('visual')) {
    return Promise.resolve({});
  }

  const getNewPath = (path: string) => {
    let newPath = path.slice(path.lastIndexOf('___') + 3);
    console.log(newPath);

    if (newPath.startsWith('/')) {
      newPath = `.${newPath}`;
    }

    return newPath;
  };

  const newPath = getNewPath(details.path);
  const newPathDir = newPath.substring(0, newPath.lastIndexOf('/'));

  try {
    fs.mkdirSync(newPathDir, { recursive: true });
    console.log('🧸 No screenshot folder found in the package. Created new screenshot folder:', newPathDir);
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
