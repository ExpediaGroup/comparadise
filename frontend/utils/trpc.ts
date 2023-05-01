import { createTRPCReact } from '@trpc/react-query';
import { AppRouter } from '../../backend';
import type { inferRouterOutputs } from '@trpc/server';

export const trpc = createTRPCReact<AppRouter>();

export type RouterOutput = inferRouterOutputs<AppRouter>;
