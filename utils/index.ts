import { baseExists, compareScreenshots } from './screenshots';
import { onAfterScreenshot } from './on-after-screenshot';

export function setupVisualTests(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
  on('task', {
    baseExists,
    compareScreenshots,
    log: (message: string) => {
      console.log(message);
      return null;
    }
  });
  on('after:screenshot', onAfterScreenshot);

  return config;
}
