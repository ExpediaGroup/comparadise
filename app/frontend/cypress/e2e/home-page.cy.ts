describe('Homepage', () => {
  it('should visit the home page', () => {
    cy.visit('/');
    cy.findByText(/Welcome to Comparadise/);
  });
});
