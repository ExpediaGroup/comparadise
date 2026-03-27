import React from 'react';
import { MainPage } from './frontend/components/main-page';
import { ClientProvider } from './frontend/providers/client-provider';
import { AcceptVisualChangesStateProvider } from './frontend/providers/accept-visual-changes-state-provider';
import { LandingPage } from './frontend/components/landing-page';
import { useSearchParams } from 'react-router-dom';
import { TRPCLink } from '@trpc/client';
import { AppRouter } from './backend/src/router';

export function App(props: {
  bucket?: string;
  commitHash?: string;
  diffId?: string;
  trpcLinks?: TRPCLink<AppRouter>[];
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
    <ClientProvider links={props.trpcLinks}>
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
