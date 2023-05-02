import * as React from 'react';
import { makeMockAdapter } from '../utils/makeMockAdapter';
import App from '../../frontend/App';

describe('App', () => {
  describe('homepage', () => {
    it('should redirect to homepage when parameters are omitted', () => {
      cy.mount(<App queryParamAdapter={makeMockAdapter({ search: '' })} />);
      cy.findByText(/Welcome to Comparadise/);
    });
  });

  describe('base, new, and diff case', () => {
    beforeEach(() => {
      cy.intercept('/trpc/getGroupedImages*', { fixture: 'images.json' });
      cy.intercept('/trpc/updateBaseImages*', { fixture: 'mutation.json' }).as('base-images');
      cy.intercept('/trpc/updateCommitStatus*', { fixture: 'mutation.json' }).as('commit-status');
      cy.mount(<App queryParamAdapter={makeMockAdapter({ search: '?hash=123&bucket=bucket&repo=repo&owner=owner' })} />);
    });

    it('should default to the base image view of the first spec in the response list', () => {
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByAltText('base');
      cy.findByRole('button', { name: /back-arrow/ }).should('be.disabled');
    });

    it.only('should default to single view', () => {
      cy.findByRole('button', { name: /single/i }).should('be.enabled');
      cy.findByRole('button', { name: /side-by-side/i }).should('be.disabled');
    });

    it('should switch to different image views', () => {
      cy.findByRole('button', { name: /diff/ }).click();
      cy.findByAltText('diff');
      cy.findByRole('button', { name: /new/ }).click();
      cy.findByAltText('new');
    });

    it('should switch between specs and default to base image for each one', () => {
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByRole('heading', { name: 'small/example' });
      cy.findByAltText('base');
      cy.findByRole('button', { name: /back-arrow/ }).click();
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByAltText('base');
      cy.findByRole('button', { name: /side-by-side/i }).should('be.disabled');
    });

    it('should switch to side-by-side view and back', () => {
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByRole('button', { name: /side-by-side/i }).should('be.enabled');
      cy.findByAltText('base');
      cy.findByAltText('diff');
      cy.findByAltText('new');
      cy.findByRole('button', { name: /single/i }).click();
      cy.findByAltText('base');
      cy.findByAltText('diff').should('not.exist');
      cy.findByAltText('new').should('not.exist');
      cy.findByRole('button', { name: /side-by-side/i }).should('be.enabled');
    });

    it('should display loader and update base images', () => {
      cy.intercept('/trpc/updateBaseImages*', { fixture: 'mutation.json', delay: 1000 }).as('base-images');
      cy.findByRole('button', { name: /Update all base images/i }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: /update/i }).click();
      cy.findByText('Updating base images...').should('be.visible');
      cy.findByLabelText('loader').should('be.visible');
      cy.wait(['@base-images', '@commit-status']);
      cy.findByRole('button', { name: /all images updated/i });
    });

    it('should do nothing if user cancels', () => {
      cy.findByRole('button', { name: /Update all base images/i }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: /cancel/i }).click();
      cy.findByRole('button', { name: /Update all base images/i }).should('be.visible');
    });

    it('should be able to update base images and disable update base images button after navigating between specs', () => {
      cy.findByRole('button', { name: /Update all base images/i }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: /update/i }).click();
      cy.wait(['@base-images', '@commit-status']);
      cy.findByRole('button', { name: /all images updated/i }).should('be.disabled');
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByRole('heading', { name: 'small/example' });
      cy.findByRole('button', { name: /all images updated/i }).should('be.disabled');
      cy.findByRole('button', { name: /back-arrow/ }).click();
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByRole('button', { name: /all images updated/i }).should('be.disabled');
    });
  });

  describe('new image only case', () => {
    beforeEach(() => {
      cy.intercept('/trpc/getGroupedImages*', { fixture: 'new-images-only.json' });
      cy.mount(<App queryParamAdapter={makeMockAdapter({ search: '?hash=123&bucket=bucket&repo=repo&owner=owner' })} />);
    });

    it('should display the new image with side-by-side view disabled', () => {
      cy.findByRole('heading', { name: 'large/new-example' });
      cy.findByRole('button', { name: /new/ });
      cy.findByAltText('new');
      cy.findByRole('button', { name: /side-by-side/i }).should('be.disabled');
    });

    it('should show new image with side-by-side view disabled when switching to another spec', () => {
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByAltText('new');
      cy.findByRole('button', { name: /side-by-side/i }).should('be.disabled');
    });
  });

  describe('no new image case', () => {
    beforeEach(() => {
      cy.intercept('/trpc/getGroupedImages*', { fixture: 'no-new-images.json' });
      cy.mount(<App queryParamAdapter={makeMockAdapter({ search: '?hash=123&bucket=bucket&repo=repo&owner=owner' })} />);
    });

    it('should default to base when no new image was found and the currently selected image is new', () => {
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByRole('button', { name: /new/ }).click();
      cy.findByAltText('new');
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByAltText('base');
    });
  });
});
