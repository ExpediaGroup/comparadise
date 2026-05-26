import { initTRPC } from '@trpc/server';
import {
  fetchCurrentPageInputSchema,
  acceptVisualChangesInputSchema,
  getVisualRegressionStatusInputSchema,
  getPullRequestUrlInputSchema
} from './schema';
import { fetchCurrentPage } from './fetchCurrentPage';
import { acceptVisualChanges } from './acceptVisualChanges';
import { getVisualRegressionStatus } from './getVisualRegressionStatus';
import { getPullRequestUrl } from './getPullRequestUrl';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router({
  fetchCurrentPage: t.procedure
    .input(fetchCurrentPageInputSchema)
    .query(({ input }) => fetchCurrentPage(input)),
  acceptVisualChanges: t.procedure
    .input(acceptVisualChangesInputSchema)
    .mutation(({ input, ctx }) => acceptVisualChanges(input, ctx)),
  getVisualRegressionStatus: t.procedure
    .input(getVisualRegressionStatusInputSchema)
    .query(({ input }) => getVisualRegressionStatus(input)),
  getPullRequestUrl: t.procedure
    .input(getPullRequestUrlInputSchema)
    .query(({ input }) => getPullRequestUrl(input))
});

export type AppRouter = typeof router;
