import './commands';

// TODO: Use React suspense to potentially avoid these console errors
Cypress.on('uncaught:exception', err => {
  if (/hydration|hydrating/i.test(err.message)) {
    return false;
  }
});
