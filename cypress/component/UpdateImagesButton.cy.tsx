import * as React from 'react';
import { UpdateImagesButton } from '../../src/components/UpdateImagesButton';
import { BaseImageStateProvider } from '../../src/providers/BaseImageStateProvider';
import { ClientProvider } from '../../src/providers/ClientProvider';
import { QueryParamProvider } from 'use-query-params';
import { makeMockAdapter } from '../utils/makeMockAdapter';

describe('UpdateImagesButton.cy.ts', () => {
  beforeEach(() => {
    cy.intercept('*updateBaseImages*', { fixture: 'mutation.json' }).as('base-images');
    cy.mount(
      <ClientProvider>
        <QueryParamProvider adapter={makeMockAdapter({ search: '?hash=123&bucket=bucket&repo=repo&owner=owner' })}>
          <BaseImageStateProvider>
            <UpdateImagesButton />
          </BaseImageStateProvider>
        </QueryParamProvider>
      </ClientProvider>
    );
  });

  it('user updates base images', () => {
    cy.findByRole('button', { name: /Update all base images/i }).click();
    cy.findByText(/Are you sure/i);
    cy.findByRole('button', { name: /update/i }).click();
    cy.wait('@base-images');
    cy.findByRole('button', { name: /all images updated/i });
  });

  it('user cancels', () => {
    cy.findByRole('button', { name: /Update all base images/i }).click();
    cy.findByText(/Are you sure/i);
    cy.findByRole('button', { name: /cancel/i }).click();
    cy.findByRole('button', { name: /Update all base images/i });
  });
});
