import { defineConfig } from 'cypress';

export default defineConfig({
  video: false,

  e2e: {
    baseUrl: 'http://localhost:8080',
    viewportWidth: 1440,
    viewportHeight: 990
  },

  component: {
    devServer: {
      framework: 'create-react-app',
      bundler: 'webpack'
    },
    viewportWidth: 1440,
    viewportHeight: 990
  }
});
