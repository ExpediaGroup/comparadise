import { matchScreenshot, MatchScreenshotArgs } from './src/match-screenshot';
export { setupVisualTests } from './src/setup-visual-tests';

export {};
declare global {
  namespace Cypress {
    interface Chainable {
      matchScreenshot(args?: MatchScreenshotArgs): Chainable;
    }
  }
}

Cypress.Commands.add('matchScreenshot', { prevSubject: ['optional', 'element', 'window', 'document'] }, matchScreenshot);
