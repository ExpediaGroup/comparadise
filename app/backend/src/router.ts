import { initTRPC } from '@trpc/server';
import {
  fetchCurrentPageInputSchema,
  updateBaseImagesInputSchema
} from './schema';
import { fetchCurrentPage } from './fetchCurrentPage';
import { updateBaseImagesInS3 } from './updateBaseImagesInS3';

const t = initTRPC.create();

export const router = t.router({
  fetchCurrentPage: t.procedure
    .input(fetchCurrentPageInputSchema)
    .query(({ input }) => fetchCurrentPage(input)),
  updateBaseImages: t.procedure
    .input(updateBaseImagesInputSchema)
    .mutation(({ input }) => updateBaseImagesInS3(input))
});

export type AppRouter = typeof router;
