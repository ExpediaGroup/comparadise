import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

export type Context = {
  urlParams: Record<string, string | undefined>;
};

export const createContext = ({
  req
}: FetchCreateContextFnOptions): Context => {
  const referer = req.headers.get('referer');
  return {
    urlParams: referer ? Object.fromEntries(new URL(referer).searchParams) : {}
  };
};
