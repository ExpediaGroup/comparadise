import * as React from 'react';
import { Main } from '../../src/components/Main';
import { ClientProvider } from '../../src/providers/ClientProvider';
import { QueryParamProvider } from 'use-query-params';
import { makeMockAdapter } from '../utils/makeMockAdapter';

describe('Main', () => {
  describe('homepage', () => {
    it('should redirect to homepage when parameters are omitted', () => {
      cy.mount(
        <ClientProvider>
          <QueryParamProvider adapter={makeMockAdapter({ search: '' })}>
            <Main />
          </QueryParamProvider>
        </ClientProvider>
      );
      cy.findByText(/Welcome to Comparadise/);
    });
  });

  describe('base, new, and diff case', () => {
    beforeEach(() => {
      cy.intercept('/trpc/getGroupedImages*', { fixture: 'images.json' });
      cy.intercept('/trpc/updateBaseImages*', { fixture: 'mutation.json' });
      cy.intercept('/trpc/updateCommitStatus*', { fixture: 'mutation.json' });
      cy.mount(
        <ClientProvider>
          <QueryParamProvider adapter={makeMockAdapter({ search: '?hash=123&bucket=bucket&repo=repo&owner=owner' })}>
            <Main />
          </QueryParamProvider>
        </ClientProvider>
      );
    });

    it('should default to the base image view of the first spec in the response list', () => {
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByAltText('base');
      cy.findByRole('button', { name: /back-arrow/ }).should('be.disabled');
    });

    it('should default to single view', () => {
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

    it('should be able to update base images and disable update base images button after navigating between specs', () => {
      cy.findByRole('button', { name: /Update all base images/i }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: /update/i }).click();
      cy.findByRole('button', { name: /all images updated/i }).should('be.disabled');
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByRole('heading', { name: 'small/example' });
      cy.findByRole('button', { name: /all images updated/i }).should('be.disabled');
      cy.findByRole('button', { name: /back-arrow/ }).click();
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByRole('button', { name: /all images updated/i }).should('be.disabled');
    });
  });

  describe('new only case', () => {
    beforeEach(() => {
      cy.intercept('/trpc/getGroupedImages*', { fixture: 'new-images-only.json' });
      cy.mount(
        <ClientProvider>
          <QueryParamProvider adapter={makeMockAdapter({ search: '?hash=123&bucket=bucket&repo=repo&owner=owner' })}>
            <Main />
          </QueryParamProvider>
        </ClientProvider>
      );
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
});
