import * as React from 'react';
import { TRPCClientErrorLike } from '@trpc/client';
import { AppRouter } from '../../backend/src/server';

export const Error = ({ error }: { error: TRPCClientErrorLike<AppRouter> }) => {
  const { data, message } = error;
  return (
    <div className="m-5 text-center">
      <h2 className="text-3xl">Error!</h2>
      <h3 className="text-xl">{`Code: ${data?.code}, Status: ${data?.httpStatus}`}</h3>
      <h4 className="mt-5 text-lg font-bold text-red-700">{message}</h4>
    </div>
  );
};
