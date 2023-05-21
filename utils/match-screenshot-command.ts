import { matchScreenshot, MatchScreenshotArgs } from './match-screenshot';

Cypress.Commands.add('matchScreenshot', { prevSubject: ['optional', 'element', 'window', 'document'] }, matchScreenshot);

declare global {
  namespace Cypress {
    interface Chainable {
      matchScreenshot(args?: MatchScreenshotArgs): Chainable;
    }
  }
}
