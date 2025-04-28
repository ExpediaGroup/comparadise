import React from 'react';
import { MainPage } from './frontend/components/main-page';
import { ClientProvider } from './frontend/providers/client-provider';
import { AcceptVisualChangesStateProvider } from './frontend/providers/accept-visual-changes-state-provider';
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
      <AcceptVisualChangesStateProvider>
        {bucket && hash ? (
          <MainPage bucket={bucket} hash={hash} />
        ) : (
          <LandingPage />
        )}
      </AcceptVisualChangesStateProvider>
    </ClientProvider>
  );
}
