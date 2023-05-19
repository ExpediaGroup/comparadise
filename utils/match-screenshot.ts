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

function forceFont() {
  const iframe = window.parent.document.querySelector('iframe');
  const contentDocument = iframe && iframe.contentDocument;

  if (contentDocument) {
    const style = contentDocument.createElement('style');
    style.type = 'text/css';
    style.appendChild(contentDocument.createTextNode('* { font-family: Arial !important; }'));
    contentDocument.head.appendChild(style);
  }
}

export type MatchScreenshotArgs = {
  rawName?: string;
  options?: Partial<Cypress.ScreenshotOptions>;
};

export function matchScreenshot(subject: Cypress.JQueryWithSelector | Window | Document | void, args?: MatchScreenshotArgs) {
  const { rawName, options = {} } = args || {};
  forceFont();
  verifyImages();


  const screenshotsFolder = 'cypress/screenshots';
  const testPath = Cypress.spec.relative;
  const lastSlashIndex = testPath.lastIndexOf('/');
  const testPathWithoutFileName = testPath.substring(0, lastSlashIndex);
  const testFileName = testPath.substring(lastSlashIndex + 1);
  const testFileNameWithoutExtension = testFileName.split('.')[0];
  const testName = rawName || testFileNameWithoutExtension;
  const screenshotPath = `${screenshotsFolder}/${testPathWithoutFileName}/${testName}`;

  cy.task('baseExists', screenshotPath).then(hasBase => {
    if (typeof hasBase !== 'boolean') throw new Error('Result of baseExists task was not a boolean.');

    const target = subject ? cy.wrap(subject) : cy;

    // Cypress prepends the configured screenshotsFolder automatically here, so we must omit it
    target.screenshot(`${testPathWithoutFileName}/${testName}/new`, { ...options, overwrite: true });

    if (!hasBase) {
      cy.task('log', `❌ A new base image was created at ${screenshotPath}. Add this as a new base image via Comparadise!`);
      return;
    }

    cy.task('compareScreenshots', screenshotPath).then(diffPixels => {
      if (typeof diffPixels !== 'number') throw new Error('Result of compareScreenshots task was not a number.');

      if (diffPixels === 0) {
        cy.log('✅ Actual image was the same as base.');
      } else {
        cy.task('log', `❌ Actual image of differed by ${diffPixels} pixels.`);
      }
    });
  });
}

declare global {
  namespace Cypress {
    interface Chainable {
      matchScreenshot(args?: MatchScreenshotArgs): Chainable;
    }
  }
}

Cypress.Commands.add('matchScreenshot', { prevSubject: ['optional', 'element', 'window', 'document'] }, matchScreenshot);
