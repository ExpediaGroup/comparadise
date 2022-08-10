import * as React from 'react';
import { QueryClientProvider } from 'react-query';
import { queryClient, trpc, trpcClient } from '../utils/trpc';

export const ClientProvider = ({ children }: React.PropsWithChildren) => (
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </trpc.Provider>
);
