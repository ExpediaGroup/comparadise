import { staticPlugin } from '@elysiajs/static';
import Elysia from 'elysia';
import { router, trpcRouter } from './backend/src/router';
import { StaticRouter } from 'react-router-dom/server';
import React from 'react';
import { App } from './app';
// @ts-expect-error - have to import from server.browser for some reason
import { renderToReadableStream } from 'react-dom/server.browser';

await Bun.build({
  entrypoints: ['./client.tsx'],
  outdir: './public',
  minify: true
});

const app = new Elysia()
  .get('/health', () => 'healthy')
  .use(trpcRouter(router))
  .use(staticPlugin())
  .get('*', async context => {
    const stream = await renderToReadableStream(
      <StaticRouter location={context.path}>
        <App />
        {process.env.NODE_ENV === 'development' && (
          <script src="https://cdn.tailwindcss.com" />
        )}
      </StaticRouter>,
      {
        bootstrapScripts: ['./public/client.js']
      }
    );
    return new Response(stream, {
      headers: { 'Content-Type': 'text/html' }
    });
  })
  .listen(process.env.PORT ?? 8080);

console.info(
  `App is running at http://${app.server?.hostname}:${app.server?.port}`
);
