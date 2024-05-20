import { AnyTRPCRouter, initTRPC } from '@trpc/server';
import {
  type FetchHandlerRequestOptions,
  fetchRequestHandler
} from '@trpc/server/adapters/fetch';
import {
  fetchCurrentPageInputSchema,
  updateBaseImagesInputSchema
} from './schema';
import { fetchCurrentPage } from './fetchCurrentPage';
import { updateBaseImagesInS3 } from './updateBaseImagesInS3';
import Elysia from 'elysia';

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

type TRPCOptions = {
  endpoint?: string;
} & Omit<
  FetchHandlerRequestOptions<AnyTRPCRouter>,
  'req' | 'router' | 'endpoint'
>;

export const trpcRouter =
  (
    router: AnyTRPCRouter,
    { endpoint = '/trpc', ...options }: TRPCOptions = { endpoint: '/trpc' }
  ) =>
  (app: Elysia) => {
    return app
      .onParse(({ request: { url } }) => {
        if (getPath(url).startsWith(endpoint)) return true;
      })
      .get(`${endpoint}/*`, async ({ request }) => {
        return fetchRequestHandler({
          ...options,
          req: request,
          router,
          endpoint
        });
      })
      .post(`${endpoint}/*`, async ({ request }) => {
        return fetchRequestHandler({
          ...options,
          req: request,
          router,
          endpoint
        });
      });
  };

const getPath = (url: string) => {
  const start = url.indexOf('/', 9);
  const end = url.indexOf('?', start);

  if (end === -1) return url.slice(start);

  return url.slice(start, end);
};
