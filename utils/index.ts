import {baseExists, compareScreenshots, createNewScreenshot, onAfterScreenshot} from './screenshots';

export function setupVisualTests(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
  on('after:screenshot', onAfterScreenshot);
  on('task', {
    baseExists,
    compareScreenshots,
    createNewScreenshot,
    log: (message: string) => {
      console.log(message);
      return null;
    }
  });

  return config;
}

declare global {
  namespace Cypress {
    interface Chainable {
      matchScreenshot(args?: MatchScreenshotArgs): Chainable;
    }
  }
}
