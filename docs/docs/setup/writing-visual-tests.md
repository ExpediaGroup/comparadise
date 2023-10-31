---
sidebar_position: 5
---

# Writing Visual Tests

Comparadise relies on [Cypress](https://www.cypress.io/) for running tests against web components in the browser.

## Installing the Cypress Plugin

Install the [comparadise-utils](https://www.npmjs.com/package/comparadise-utils) package using your favorite node package manager.

```shell
npm install --save-dev comparadise-utils
```

## Configuring Cypress

In `cypress.config.ts`:

```ts
import { setupVisualTests } from 'comparadise-utils';

export default defineConfig({
  component: {
    setupNodeEvents(on, config) {
      setupVisualTests(on, config);

      return config;
    }
  },
  e2e: {
    setupNodeEvents(on, config) {
      setupVisualTests(on, config);

      return config;
    }
  }
});
```

In `cypress/support/commands.ts`:

```ts
import 'comparadise-utils/commands';
import 'comparadise-utils/types';
```

## Test Setup

In a Cypress test that renders your component or visits your site, use the `cy.matchScreenshot()` command to execute a visual test.
This will take a screenshot of whatever Cypress is currently displaying, compare it to a `base.png` that was
previously downloaded from S3, and output a `diff.png` and `new.png` if there is a visual change.

Example test:

```tsx
describe('MyComponent visual test', () => {
  it('should verify MyComponent looks the same', () => {
    cy.mount(<MyComponent inputs={mockInputs} />);

    cy.matchScreenshot();
  });
});
```

### cy.matchScreenshot Arguments

#### rawName - optional (String)

By default, `matchScreenshot` will infer the name of your test from the name of your file and create a folder to save the base, new, and diff images to.

However, if you have multiple visual tests in a single file, you are required to provide a different `rawName` for each test to vary the paths where screenshots will be saved.

#### options - optional (Cypress.ScreenshotOptions)

Learn more about the `options` argument definition in [Cypress' official docs](https://docs.cypress.io/api/commands/screenshot.html#Arguments).
