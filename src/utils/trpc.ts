import { createReactQueryHooks } from '@trpc/react';
import { AppRouter } from '../../server';
import { QueryClient } from 'react-query';
import { inferProcedureOutput } from '@trpc/server';

export const trpc = createReactQueryHooks<AppRouter>();
export const queryClient = new QueryClient();
export const trpcClient = trpc.createClient({ url: '/trpc' });

export type TQuery = keyof AppRouter['_def']['queries'];
export type InferQueryOutput<TRouteKey extends TQuery> = inferProcedureOutput<AppRouter['_def']['queries'][TRouteKey]>;
