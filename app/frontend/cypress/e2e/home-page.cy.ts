describe('Homepage', () => {
  it('should visit the home page', () => {
    cy.visit('/');
    cy.findByText(/Welcome to Comparadise/).should('be.visible');
  });

  it('should return 200 response for health check', () => {
    cy.visit('/health');
    cy.findByText(/healthy/).should('be.visible');
  });
});
