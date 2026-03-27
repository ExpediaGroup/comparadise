import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc } from '../utils/trpc';
import { httpBatchLink, TRPCLink } from '@trpc/client';
import { AppRouter } from '../../backend/src/router';

export const ClientProvider = ({
  children,
  links
}: React.PropsWithChildren<{ links?: TRPCLink<AppRouter>[] }>) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: Infinity,
            retry: false
          }
        }
      })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: links ?? [
        httpBatchLink({
          url: '/trpc'
        })
      ]
    })
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
};
