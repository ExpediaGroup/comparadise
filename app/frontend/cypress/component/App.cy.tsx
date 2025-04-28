import * as React from 'react';
import { App } from '../../../app';
import {
  firstPage,
  noNewImagesPage,
  onlyNewImagesFirstPage,
  onlyNewImagesSecondPage,
  secondPage
} from '../mocks/pages';
import {
  acceptVisualChangesRejection,
  MOCK_ERROR_MESSAGE
} from '../mocks/accept-visual-changes-rejection';
import { mutationResponse } from '../mocks/mutation';
import { MemoryRouter } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPageFromRequest(req: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (JSON.parse(req.query.input as string) as any)['0'].page;
}

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
      cy.intercept('/trpc/acceptVisualChanges*', { body: mutationResponse }).as(
        'accept-visual-changes'
      );
      cy.mount(
        <MemoryRouter
          initialEntries={[
            '/?commitHash=123&bucket=bucket&repo=repo&owner=owner'
          ]}
        >
          <App />
        </MemoryRouter>
      );
    });

    it('should default to the diff image view of the first spec in the response list', () => {
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByAltText('diff').should('be.visible');
      cy.findByRole('button', { name: /back-arrow/ }).should('be.disabled');
    });

    it('should default to single view', () => {
      cy.findByRole('button', { name: /single/i }).should('be.enabled');
      cy.findByRole('button', { name: /side-by-side/i }).should('be.disabled');
    });

    it('should switch to different image views', () => {
      cy.findByAltText('diff').should('be.visible');
      cy.findByRole('button', { name: 'new' }).click();
      cy.findByAltText('new').should('be.visible');
      cy.findByRole('button', { name: 'base' }).click();
      cy.findByAltText('base').should('be.visible');
    });

    it('should switch between specs and default to diff image for each one', () => {
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByRole('heading', { name: 'small/example' });
      cy.findByAltText('diff').should('be.visible');
      cy.findByRole('button', { name: /back-arrow/ }).click();
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByAltText('diff').should('be.visible');
    });

    it('should switch to side-by-side view and back', () => {
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByRole('button', { name: /side-by-side/i }).should('be.enabled');
      cy.findByAltText('base').should('be.visible');
      cy.findByAltText('diff').should('be.visible');
      cy.findByAltText('new').should('be.visible');
      cy.findByRole('button', { name: /single/i }).click();
      cy.findByAltText('diff').should('be.visible');
      cy.findByAltText('base').should('not.exist');
      cy.findByAltText('new').should('not.exist');
      cy.findByRole('button', { name: /side-by-side/i }).should('be.enabled');
    });

    it('should display loader while updating base images', () => {
      cy.intercept('/trpc/acceptVisualChanges*', {
        body: mutationResponse,
        delay: 5000
      }).as('accept-visual-changes');
      cy.findByRole('button', { name: 'Accept visual changes' }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: 'Accept' }).click();
      cy.findByText('Accepting visual changes...').should('be.visible');
      cy.findByLabelText('loader').should('be.visible');
    });

    it('should accept visual changes', () => {
      cy.findByRole('button', { name: 'Accept visual changes' }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: 'Accept' }).click();
      cy.wait('@accept-visual-changes');
      cy.findByRole('button', { name: /Visual changes accepted/i });
    });

    it('should do nothing if user cancels', () => {
      cy.findByRole('button', { name: 'Accept visual changes' }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: /cancel/i }).click();
      cy.findByRole('button', { name: 'Accept visual changes' }).should(
        'be.visible'
      );
    });

    it('should be able to accept visual changes and disable accept visual changes button after navigating between specs', () => {
      cy.findByRole('button', { name: 'Accept visual changes' }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: 'Accept' }).click();
      cy.wait('@accept-visual-changes');
      cy.findByRole('button', { name: /Visual changes accepted/i }).should(
        'be.disabled'
      );
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByRole('heading', { name: 'small/example' });
      cy.findByRole('button', { name: /Visual changes accepted/i }).should(
        'be.disabled'
      );
      cy.findByRole('button', { name: /back-arrow/ }).click();
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByRole('button', { name: /Visual changes accepted/i }).should(
        'be.disabled'
      );
    });

    it('should display failure message and not update commit status when base images fail to update', () => {
      cy.intercept('/trpc/acceptVisualChanges*', {
        statusCode: 403,
        body: acceptVisualChangesRejection
      }).as('accept-visual-changes');
      cy.findByRole('button', { name: 'Accept visual changes' }).click();
      cy.findByText(/Are you sure/i);
      cy.findByRole('button', { name: 'Accept' }).click();
      cy.wait('@accept-visual-changes');
      cy.findByRole('button', { name: /Visual changes accepted/i }).should(
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
          initialEntries={[
            '?commitHash=123&bucket=bucket&repo=repo&owner=owner'
          ]}
        >
          <App />
        </MemoryRouter>
      );
    });

    it('should display the new image with side-by-side view disabled', () => {
      cy.findByRole('heading', { name: 'large/new-example' });
      cy.findByRole('button', { name: /new/ });
      cy.findByAltText('new').should('be.visible');
      cy.findByRole('button', { name: /side-by-side/i }).should('be.disabled');
    });

    it('should show new image with side-by-side view disabled when switching to another spec', () => {
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByAltText('new').should('be.visible');
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
          initialEntries={[
            '?commitHash=123&bucket=bucket&repo=repo&owner=owner'
          ]}
        >
          <App />
        </MemoryRouter>
      );
    });

    it('should default to diff when no new image was found and the currently selected image is new', () => {
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByRole('button', { name: /new/ }).click();
      cy.findByAltText('new').should('be.visible');
      cy.findByRole('button', { name: /forward-arrow/ }).click();
      cy.findByAltText('diff').should('be.visible');
    });
  });

  describe('diffId param case', () => {
    beforeEach(() => {
      cy.intercept('/trpc/fetchCurrentPage*', req => {
        const page = getPageFromRequest(req);
        const body = page === 2 ? noNewImagesPage : firstPage;
        req.reply(body);
      });
      cy.mount(
        <MemoryRouter
          initialEntries={['?diffId=123&bucket=bucket&repo=repo&owner=owner']}
        >
          <App />
        </MemoryRouter>
      );
    });

    it('should use diffId param when commitId not provided', () => {
      cy.findByRole('heading', { name: 'large/example' });
      cy.findByAltText('diff').should('be.visible');
    });
  });
});
