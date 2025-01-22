import React from 'react';
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
    <ClientProvider>
      <BaseImageStateProvider>
        {bucket && hash ? (
          <MainPage bucket={bucket} hash={hash} />
        ) : (
          <LandingPage />
        )}
      </BaseImageStateProvider>
    </ClientProvider>
  );
}
