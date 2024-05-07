const PREFIX_DIFFERENTIATOR = '___';
const SUFFIX_TEST_IDENTIFIER = '.spec.ts';
const SCREENSHOTS_FOLDER_NAME = 'screenshots';

function forceFont() {
  const iframe = window.parent.document.querySelector('iframe');
  const contentDocument = iframe && iframe.contentDocument;

  if (contentDocument) {
    const style = contentDocument.createElement('style');
    style.type = 'text/css';
    style.appendChild(
      contentDocument.createTextNode('* { font-family: Arial !important; }')
    );
    contentDocument.head.appendChild(style);
    return style;
  }

  return false;
}

function getTestFolderPathFromScripts(rawName?: string) {
  const relativeTestPath = Cypress.spec.relative;

  if (!relativeTestPath) {
    throw new Error(
      '❌ Could not find matching script in the Cypress DOM to infer the test folder path'
    );
  }

  const currentTestNumber = Cypress.mocha.getRunner().currentRunnable?.order;
  if (
    !rawName &&
    typeof currentTestNumber === 'number' &&
    currentTestNumber > 1
  ) {
    throw new Error(
      '❌ The rawName argument was not provided to matchScreenshot and is required for test files containing multiple tests!'
    );
  }

  const testName = relativeTestPath.substring(
    relativeTestPath.lastIndexOf('/') + 1,
    relativeTestPath.lastIndexOf(SUFFIX_TEST_IDENTIFIER)
  );
  const name = rawName || testName;

  const screenshotsFolder = `${SCREENSHOTS_FOLDER_NAME}/${relativeTestPath.substring(
    0,
    relativeTestPath.lastIndexOf(testName)
  )}${name}`;

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

export type MatchScreenshotArgs = {
  rawName?: string;
  options?: Partial<Cypress.ScreenshotOptions>;
};

export function matchScreenshot(
  subject: Cypress.JQueryWithSelector | Window | Document | void,
  args?: MatchScreenshotArgs
) {
  const { rawName, options = {} } = args || {};
  // Set up screen
  forceFont();

  // Making sure each image is visible before taking screenshots
  verifyImages();

  const { name, screenshotsFolder } = getTestFolderPathFromScripts(rawName);

  cy.task('baseExists', screenshotsFolder).then(hasBase => {
    const target = subject ? cy.wrap(subject) : cy;
    // For easy slicing of path ignoring the root screenshot folder
    target.screenshot(
      `${PREFIX_DIFFERENTIATOR}${screenshotsFolder}/new`,
      options
    );

    if (!hasBase) {
      cy.task(
        'log',
        `✅ A new base image was created for ${name}. Create this as a new base image via Comparadise!`
      );

      return null;
    }

    cy.task('compareScreenshots', screenshotsFolder).then(diffPixels => {
      if (diffPixels === 0) {
        cy.log(`✅ Actual image of ${name} was the same as base`);
      } else {
        throw new Error(
          `❌ Actual image of ${name} differed by ${diffPixels} pixels.`
        );
      }

      return null;
    });

    return null;
  });
}

Cypress.Commands.add(
  'matchScreenshot',
  { prevSubject: ['optional', 'element', 'window', 'document'] },
  matchScreenshot
);

interface ExtendedCurrentRunnable extends Mocha.Runnable {
  currentRunnable?: {
    order?: unknown;
  };
}

declare global {
  namespace Cypress {
    interface Cypress {
      mocha: {
        getRunner: () => ExtendedCurrentRunnable;
      };
    }
  }
}
