import * as fs from 'fs';

export function onAfterScreenshot(details: Cypress.ScreenshotDetails): Promise<Cypress.AfterScreenshotReturnObject> {
  console.log('🧸 Screenshot was saved to:', details.path);
  if (!details.path.match('visual')) {
    return Promise.resolve({});
  }

  const newPath = details.path.substring(details.path.lastIndexOf('cypress/screenshots'));
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

      resolve({ path: newPath });
    });
  });
}
