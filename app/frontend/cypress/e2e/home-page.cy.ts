describe('Homepage', () => {
  it('should visit the home page', () => {
    cy.visit('/');
    cy.findByText(/Welcome to Comparadise/).should('be.visible');
  });

  it('should return 200 response for health check', () => {
    cy.request('/health').should(response => {
      expect(response.status).to.eq(200);
    });
  });
});
