import * as React from 'react';
import { App } from '../../../app';
import {
  firstPage,
  noNewImagesPage,
  onlyNewImagesFirstPage,
  onlyNewImagesSecondPage,
  secondPage
} from '../mocks/pages';
import { CyHttpMessages } from 'cypress/types/net-stubbing';
import {
  baseImageUpdateRejection,
  MOCK_ERROR_MESSAGE
} from '../mocks/base-image-update-rejection';
import { mutationResponse } from '../mocks/mutation';
import { MemoryRouter } from 'react-router-dom';

const getPageFromRequest = (req: CyHttpMessages.IncomingHttpRequest) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (JSON.parse(req.query.input as string) as any)['0'].page;

describe('App', () => {
  describe('homepage', () => {
    it('should redirect to homepage when parameters are omitted', () => {
      cy.mount(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );
      cy.findByText(/Welcome to Comparadise/);
    });
  });

  describe('base, new, and diff case', () => {
    beforeEach(() => {
      cy.intercept('/trpc/fetchCurrentPage*', req => {
        const page = getPageFromRequest(req);
        const body = page === 2 ? secondPage : firstPage;
        req.reply(body);
      });
      cy.intercept('/trpc/updateBaseImages*', { body: mutationResponse }).as(
        'base-images'
      );
      cy.mount(
        <MemoryRouter
          initialEntries={['/?hash=123&bucket=bucket&repo=repo&owner=owner']}
        >
          <App />
        </MemoryRouter>
      );
    });

    it('should default to the diff image view of the first spec in the response list', () => {
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByAltText('diff');
      cy.findByRole('button', { name: /back-arrow/ }).should('be.disabled');
    });

    it('should default to single view', () => {
      cy.findByRole('button', { name: /single/i }).should('be.enabled');
      cy.findByRole('button', { name: /side-by-side/i }).should('be.disabled');
    });

    it('should switch to different image views', () => {
      cy.findByAltText('diff');
      cy.findByRole('button', { name: 'new' }).click();
      cy.findByAltText('new');
      cy.findByRole('button', { name: 'base' }).click();
      cy.findByAltText('base');
    });

    it('should switch between specs and default to diff image for each one', () => {
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByRole('heading', { name: 'small/example' });
      cy.findByAltText('diff');
      cy.findByRole('button', { name: /back-arrow/ }).click();
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByAltText('diff');
    });

    it('should switch to side-by-side view and back', () => {
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByRole('button', { name: /side-by-side/i }).should('be.enabled');
      cy.findByAltText('base');
      cy.findByAltText('diff');
      cy.findByAltText('new');
      cy.findByRole('button', { name: /single/i }).click();
      cy.findByAltText('diff');
      cy.findByAltText('base').should('not.exist');
      cy.findByAltText('new').should('not.exist');
      cy.findByRole('button', { name: /side-by-side/i }).should('be.enabled');
    });

    it('should display loader while updating base images', () => {
      cy.intercept('/trpc/updateBaseImages*', {
        body: mutationResponse,
        delay: 5000
      }).as('base-images');
      cy.findByRole('button', { name: /Update all base images/i }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: /update/i }).click();
      cy.findByText('Updating base images...').should('be.visible');
      cy.findByLabelText('loader').should('be.visible');
    });

    it('should update base images', () => {
      cy.findByRole('button', { name: /Update all base images/i }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: /update/i }).click();
      cy.wait('@base-images');
      cy.findByRole('button', { name: /all images updated/i });
    });

    it('should do nothing if user cancels', () => {
      cy.findByRole('button', { name: /Update all base images/i }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: /cancel/i }).click();
      cy.findByRole('button', { name: /Update all base images/i }).should(
        'be.visible'
      );
    });

    it('should be able to update base images and disable update base images button after navigating between specs', () => {
      cy.findByRole('button', { name: /Update all base images/i }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: /update/i }).click();
      cy.wait('@base-images');
      cy.findByRole('button', { name: /all images updated/i }).should(
        'be.disabled'
      );
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByRole('heading', { name: 'small/example' });
      cy.findByRole('button', { name: /all images updated/i }).should(
        'be.disabled'
      );
      cy.findByRole('button', { name: /back-arrow/ }).click();
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByRole('button', { name: /all images updated/i }).should(
        'be.disabled'
      );
    });

    it('should display failure message and not update commit status when base images fail to update', () => {
      cy.intercept('/trpc/updateBaseImages*', {
        statusCode: 403,
        body: baseImageUpdateRejection
      }).as('base-images');
      cy.findByRole('button', { name: /Update all base images/i }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: /update/i }).click();
      cy.wait('@base-images');
      cy.findByRole('button', { name: /all images updated/i }).should(
        'not.exist'
      );
      cy.findByRole('heading', { name: /Error/ }).should('be.visible');
      cy.findByText(MOCK_ERROR_MESSAGE).should('be.visible');
    });
  });

  describe('new image only case', () => {
    beforeEach(() => {
      cy.intercept('/trpc/fetchCurrentPage*', req => {
        const page = getPageFromRequest(req);
        const body =
          page === 2 ? onlyNewImagesSecondPage : onlyNewImagesFirstPage;
        req.reply(body);
      });
      cy.mount(
        <MemoryRouter
          initialEntries={['?hash=123&bucket=bucket&repo=repo&owner=owner']}
        >
          <App />
        </MemoryRouter>
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

  describe('no new image case', () => {
    beforeEach(() => {
      cy.intercept('/trpc/fetchCurrentPage*', req => {
        const page = getPageFromRequest(req);
        const body = page === 2 ? noNewImagesPage : firstPage;
        req.reply(body);
      });
      cy.mount(
        <MemoryRouter
          initialEntries={['?hash=123&bucket=bucket&repo=repo&owner=owner']}
        >
          <App />
        </MemoryRouter>
      );
    });

    it('should default to diff when no new image was found and the currently selected image is new', () => {
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByRole('button', { name: /new/ }).click();
      cy.findByAltText('new');
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByAltText('diff');
    });
  });
});
