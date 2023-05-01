import './commands';

import { mount } from 'cypress/react18';

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);

Cypress.on('uncaught:exception', (err, runnable) => {
  if (err.message.includes('Access Denied')) {
    return false
  }
});
