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

  const { screenshotsFolder } = Cypress.config();
  if (!screenshotsFolder) {
    throw new Error('No screenshots folder found!');
  }

  cy.task('baseExists', screenshotsFolder).then(hasBase => {
    const target = subject ? cy.wrap(subject) : cy;
    target.screenshot('new', { ...options, overwrite: true });

    if (!hasBase) {
      cy.task('log', `❌ A new base image was created. Add this as a new base image via Comparadise!`);
      return;
    }

    cy.task('compareScreenshots', screenshotsFolder).then(diffPixels => {
      if (diffPixels === 0) {
        cy.log('✅ Actual image was the same as base.');

        return null;
      }

      cy.task('log', `❌ Actual image of differed by ${diffPixels} pixels.`);
    });

    return null;
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
