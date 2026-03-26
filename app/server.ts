import { router } from './backend/src/router';
import { logEvent } from './backend/src/logger';
import { createBunHttpHandler } from 'trpc-bun-adapter';
import { serve, file } from 'bun';
import { join } from 'path';
import index from './public/index.html';

const IS_PROD = process.env.NODE_ENV === 'production';
const DIST_DIR = join(import.meta.dir, 'dist');

const trpcHandler = createBunHttpHandler({
  router,
  endpoint: '/trpc',
  onError: ({ error: { code, message, cause }, path, req }) => {
    const referer = req.headers.get('referer');
    const urlParams = referer
      ? Object.fromEntries(new URL(referer).searchParams)
      : {};
    logEvent('ERROR', { path, code, message, cause, ...urlParams });
  }
});

const server = serve({
  routes: {
    '/': IS_PROD ? file(join(DIST_DIR, 'index.html')) : index,
    '/health': new Response('healthy', { status: 200 })
  },
  port: process.env.PORT ?? 8080,
  async fetch(request, response) {
    const trpcResponse = trpcHandler(request, response);
    if (trpcResponse) return trpcResponse;

    if (IS_PROD) {
      const assetFile = file(join(DIST_DIR, new URL(request.url).pathname));
      if (await assetFile.exists()) {
        return new Response(assetFile);
      }
    }

    return new Response('Not found', { status: 404 });
  }
});

logEvent('INFO', { message: `Server running at ${server.url}` });
