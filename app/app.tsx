import React from 'react';
import { MainPage } from './frontend/components/main-page';
import { ClientProvider } from './frontend/providers/client-provider';
import { BaseImageStateProvider } from './frontend/providers/base-image-state-provider';

export function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href="/public/island.svg" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"
        />
        <link rel="stylesheet" href="/public/globals.css" />
        <title>Comparadise</title>
      </head>
      <body>
        <ClientProvider>
          <BaseImageStateProvider>
            <MainPage />
          </BaseImageStateProvider>
        </ClientProvider>
      </body>
    </html>
  );
}
