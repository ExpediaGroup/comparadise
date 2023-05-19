import { baseExists, compareScreenshots } from './screenshots';

export function setupVisualTests(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
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
