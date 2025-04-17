import {
  forceFont,
  getTestFolderPathFromScripts,
  MatchScreenshotArgs,
  PREFIX_DIFFERENTIATOR,
  verifyImages
} from './match-screenshot';

export function createBaseImage(
  subject: Cypress.JQueryWithSelector | Window | Document | void,
  args?: MatchScreenshotArgs
) {
  const { rawName, options } = args || {};
  // Set up screen
  forceFont();
  // Making sure each image is visible before taking screenshots
  verifyImages();

  const { name, screenshotsFolder } = getTestFolderPathFromScripts(rawName);
  const target = subject ? cy.wrap(subject) : cy;

  // Create a new updated base image to compare against
  target.screenshot(
    `${PREFIX_DIFFERENTIATOR}${screenshotsFolder}/base`,
    options
  );

  cy.task('log', `✅ A new base image was created for ${name}.`);
}

Cypress.Commands.add(
  'createBaseImage',
  { prevSubject: ['optional', 'element', 'window', 'document'] },
  createBaseImage
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
