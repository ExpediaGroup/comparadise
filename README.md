# comparadise <img height=40 src="https://www.svgrepo.com/show/300635/island.svg">

### A visual comparison tool for testing and reviewing visual changes in web applications.

## Features

The easiest way to get started with Comparadise is to use all the included features together!

| Feature                       | Requirements                                                      |
| ----------------------------- | ----------------------------------------------------------------- |
| Comparadise web app           | Deploy to any environment using [Docker](https://www.docker.com/) |
| Cloud storage for screenshots | [AWS S3](https://aws.amazon.com/s3/)                              |
| CI test execution             | [GitHub Actions](https://github.com/features/actions)             |
| Visual test utilities         | [Cypress](https://www.cypress.io/)                                |

## Deploying Comparadise

Comparadise ships a web application that can be deployed using Docker. An example Dockerfile might look something like this:

```Dockerfile
FROM expediagroup/comparadise:latest
```

## Setting Up Cloud Storage

Make sure you create an S3 bucket using AWS. This is where Comparadise will read from (and write to) when your tests run
and when you use the Comparadise app to review changes.

## Writing Visual Tests

Install the [comparadise-utils](https://www.npmjs.com/package/comparadise-utils) package using your favorite node package manager.

In `cypress.config.ts`:

```ts
import { setupVisualTests } from 'comparadise-utils';

export default defineConfig({
  component: {
    setupNodeEvents(on, config) {
      setupVisualTests(on, config);

      return config;
    },
  },
  e2e: {
    setupNodeEvents(on, config) {
      setupVisualTests(on, config);

      return config;
    },
  },
});
```

In `cypress/support/commands.ts`:

```ts
import 'comparadise-utils/commands';
import 'comparadise-utils/types';
```

In a Cypress test that renders your component or visits your site, use `cy.matchScreenshot()` to execute a visual test.
This will take a screenshot of whatever Cypress is currently displaying, compare it to a `base.png` that was
previously downloaded from S3, and output a `diff.png` and `new.png` if there is a visual change.

## Executing Your Visual Tests

Usage:

```yaml
- name: Run Visual Tests
  uses: ExpediaGroup/comparadise@v1
  with:
    visual-test-command: npm run visual-tests
    bucket-name: visual-regression-bucket
    commit-hash: ${{ github.event.pull_request.head.sha }}
```

This action will do the following:

- Downloads base images from your S3 bucket
- Runs your visual tests
- Checks for "diff" and "new" base images
- Conditionally uploads "diff" and "new" images to your S3 bucket
- Conditionally leaves a PR comment with a Comparadise link
- Sets the appropriate Visual Regression commit status on the PR

Therefore, your visual test workflow must check out your repo, install dependencies to run your visual tests, and obtain AWS credentials prior to running the Comparadise action.
