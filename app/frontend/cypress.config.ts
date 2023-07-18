import { defineConfig } from 'cypress';

export default defineConfig({
  screenshotOnRunFailure: false,
  video: false,

  e2e: {
    baseUrl: 'http://localhost:8080',
    viewportWidth: 1440,
    viewportHeight: 990
  },

  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite'
    },
    viewportWidth: 1440,
    viewportHeight: 990
  }
});
