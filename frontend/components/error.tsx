import * as React from 'react';
import { TRPCClientErrorLike } from '@trpc/client';
import { AppRouter } from '../../backend/server';

export const Error = ({ error }: { error: TRPCClientErrorLike<AppRouter> }) => {
  const { data, message } = error;
  return (
    <div className="text-center m-5">
      <h1>Error!</h1>
      <h2>{`Code: ${data?.code}, Status: ${data?.httpStatus}`}</h2>
      <h3>{message}</h3>
    </div>
  );
};