import React, { PropsWithChildren } from 'react';
import { MainPage } from './frontend/components/main-page';
import { ClientProvider } from './frontend/providers/client-provider';
import { BaseImageStateProvider } from './frontend/providers/base-image-state-provider';
import { LandingPage } from './frontend/components/landing-page';
import { useSearchParams } from 'react-router-dom';

export function App(props: {
  bucket?: string;
  commitHash?: string;
  diffId?: string;
}) {
  const [searchParams] = useSearchParams();
  const params: Record<string, string | undefined> = Object.fromEntries(
    searchParams.entries()
  );
  const bucket = props.bucket ?? params.bucket;
  const commitHash = props.commitHash ?? params.commitHash;
  const diffId = props.diffId ?? params.diffId;
  const hash = commitHash ?? diffId;

  return (
    <PageWrapper>
      {bucket && hash ? (
        <MainPage bucket={bucket} hash={hash} />
      ) : (
        <LandingPage />
      )}
    </PageWrapper>
  );
}

function PageWrapper(props: PropsWithChildren) {
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
          <BaseImageStateProvider>{props.children}</BaseImageStateProvider>
        </ClientProvider>
      </body>
    </html>
  );
}
