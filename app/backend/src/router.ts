import { initTRPC } from '@trpc/server';
import {
  fetchCurrentPageInputSchema,
  acceptVisualChangesInputSchema
} from './schema';
import { fetchCurrentPage } from './fetchCurrentPage';
import { acceptVisualChanges } from './acceptVisualChanges';

const t = initTRPC.create();

export const router = t.router({
  fetchCurrentPage: t.procedure
    .input(fetchCurrentPageInputSchema)
    .query(({ input }) => fetchCurrentPage(input)),
  acceptVisualChanges: t.procedure
    .input(acceptVisualChangesInputSchema)
    .mutation(({ input }) => acceptVisualChanges(input))
});

export type AppRouter = typeof router;
