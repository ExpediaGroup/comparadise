import { initTRPC } from '@trpc/server';
import {
  fetchCurrentPageInputSchema,
  acceptVisualChangesInputSchema
} from './schema';
import { fetchCurrentPage } from './fetchCurrentPage';
import { acceptVisualChanges } from './acceptVisualChanges';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router({
  fetchCurrentPage: t.procedure
    .input(fetchCurrentPageInputSchema)
    .query(({ input }) => fetchCurrentPage(input)),
  acceptVisualChanges: t.procedure
    .input(acceptVisualChangesInputSchema)
    .mutation(({ input, ctx }) => acceptVisualChanges(input, ctx))
});

export type AppRouter = typeof router;
