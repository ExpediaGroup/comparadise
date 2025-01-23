import { router } from './backend/src/router';
import { createBunHttpHandler } from 'trpc-bun-adapter';
import { serve } from 'bun';
import index from './public/index.html';

const server = serve({
  static: {
    '/': index
  },
  port: process.env.PORT ?? 8080,
  async fetch(request, response) {
    const trpcHandler = createBunHttpHandler({ router, endpoint: '/trpc' });
    return (
      trpcHandler(request, response) ??
      new Response('Not found', { status: 404 })
    );
  },
  development: true
});

console.log(`Server running at ${server.url}`);
