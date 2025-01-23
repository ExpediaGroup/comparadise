import './commands';

import { mount } from 'cypress/react';
import { MOCK_ERROR_MESSAGE } from '../mocks/base-image-update-rejection';

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);

Cypress.on('uncaught:exception', err => {
  if (err.message.includes(MOCK_ERROR_MESSAGE)) {
    return false;
  }
});
