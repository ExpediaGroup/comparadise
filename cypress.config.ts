import { defineConfig } from 'cypress';

export default defineConfig({
  fixturesFolder: 'app/frontend/cypress/fixtures',
  screenshotOnRunFailure: false,
  video: false,

  e2e: {
    baseUrl: 'http://localhost:8080',
    specPattern: '**/*.spec.ts',
    supportFile: 'app/frontend/cypress/support/e2e.ts',
    viewportWidth: 1440,
    viewportHeight: 990
  },

  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite'
    },
    indexHtmlFile: 'app/frontend/cypress/support/component-index.html',
    specPattern: '**/*.spec.tsx',
    supportFile: 'app/frontend/cypress/support/component.ts',
    viewportWidth: 1440,
    viewportHeight: 990
  }
});
