import { TRPCErrorResponse } from '@trpc/server/rpc';

export const baseImageUpdateRejection: TRPCErrorResponse = {
  error: {
    message:
      'At least one non-visual status check has not passed on your PR. Please ensure all other checks have passed before updating base images!',
    code: -32603,
    data: {
      code: 'FORBIDDEN',
      httpStatus: 403,
      stack: 'AccessDenied',
      path: 'updateBaseImages',
    },
  },
};
