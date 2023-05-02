import './commands';

import { mount } from 'cypress/react18';
import '../../frontend/App.css';

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
