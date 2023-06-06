import { createTRPCReact } from '@trpc/react-query';
import { AppRouter } from '../../backend/server';
import type { inferRouterOutputs } from '@trpc/server';

export const trpc = createTRPCReact<AppRouter>();

export type RouterOutput = inferRouterOutputs<AppRouter>;
