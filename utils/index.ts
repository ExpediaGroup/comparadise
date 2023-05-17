export * from './src';

const PREFIX_DIFFERENTIATOR = '___';
const SUFFIX_TEST_IDENTIFIER = '.spec.ts';
const SCREENSHOTS_FOLDER_NAME = 'screenshots';

/**
 * Gets the scripts from the Cypress browser and return the path of the test
 * script that is currently trying to match the screenshot
 * @param {string?} rawName
 * @returns {{name: string, screenshotsFolder: string}}
 */
function getTestFolderPathFromScripts(rawName?: string) {
  const relativeTestPath = Cypress.spec.relative;

  if (!relativeTestPath) {
    throw new Error('❌ Could not find matching script in the Cypress DOM to infer the test folder path');
  }

  // i.e. payment-card-cvvdialog
  const testName = relativeTestPath.substring(relativeTestPath.lastIndexOf('/') + 1, relativeTestPath.lastIndexOf(SUFFIX_TEST_IDENTIFIER));
  const name = rawName || testName;

  // i.e. screenshots/packages/flights/forced-choice/test/visual/forced-choice/payment-card-cvvdialog
  const screenshotsFolder = `${SCREENSHOTS_FOLDER_NAME}/${relativeTestPath.substring(0, relativeTestPath.lastIndexOf(testName))}${name}`;

  return {
    name,
    screenshotsFolder
  };
}

function verifyImages() {
  if (Cypress.$('img:visible').length > 0) {
    cy.document()
      .its('body')
      .find('img')
      .filter(':visible')
      .then(images => {
        if (images) {
          cy.wrap(images).each($img => {
            cy.wrap($img).should('exist').and('have.prop', 'naturalWidth');
          });
        }
      });
  }
}

interface MatchScreenshotArgs {
  rawName?: string;
  options?: Partial<Cypress.ScreenshotOptions>;
}

function matchScreenshot(subject: Cypress.JQueryWithSelector | Window | Document | void, args?: MatchScreenshotArgs) {
  const { rawName, options = {} } = args ?? {};
  // Making sure each image is visible before taking screenshots
  verifyImages();

  const { name, screenshotsFolder } = getTestFolderPathFromScripts(rawName);

  cy.task('baseExists', screenshotsFolder).then(hasBase => {
    const type = 'new';
    const target = subject ? cy.wrap(subject) : cy;
    // For easy slicing of path ignoring the root screenshot folder
    target.screenshot(`${PREFIX_DIFFERENTIATOR}${screenshotsFolder}/${type}`, options);

    if (!hasBase) {
      cy.task('createNewScreenshot', screenshotsFolder).then(() => {
        cy.task('log', `❌A new base image was created for ${name}. Create this as a new base image via Comparadise!`);
      });
    }

    cy.task('compareScreenshots', screenshotsFolder).then(diffPixels => {
      if (diffPixels === 0) {
        cy.log(`✅Actual image of ${name} was the same as base`);

        return null;
      }

      const screenshotUrl = Cypress.env('BUILD_URL') ? `${Cypress.env('BUILD_URL')}artifact/${screenshotsFolder}` : screenshotsFolder;

      throw new Error(
        `❌Actual image of ${name} differed by ${diffPixels} pixels.
             See the diff image for more details >>  ${screenshotUrl}/diff.png`
      );
    });

    return null;
  });
}

Cypress.Commands.add('matchScreenshot', { prevSubject: ['optional', 'element', 'window', 'document'] }, matchScreenshot);

declare global {
  namespace Cypress {
    interface Chainable {
      matchScreenshot(args?: MatchScreenshotArgs): Chainable;
    }
  }
}
