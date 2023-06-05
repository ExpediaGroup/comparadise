import './commands';

import { mount } from 'cypress/react18';
import '../../App.css';
import { UPDATE_BASE_IMAGES_ERROR_MESSAGE } from '../../../../shared';

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);

Cypress.on('uncaught:exception', err => {
  if (err.message.includes(UPDATE_BASE_IMAGES_ERROR_MESSAGE)) {
    return false;
  }
});
