import {
  baseExists,
  compareScreenshots,
  onAfterScreenshot
} from './screenshots';
import { MatchScreenshotArgs, TakeScreenshotArgs } from './screenshot-actions';

export function setupVisualTests(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
) {
  on('after:screenshot', onAfterScreenshot);
  on('task', {
    baseExists,
    compareScreenshots,
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
      takeScreenshot(args?: TakeScreenshotArgs): Chainable;
      createBaseImage(args?: MatchScreenshotArgs): Chainable;
    }
  }
}
