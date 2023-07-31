import { TRPCErrorResponse } from '@trpc/server/rpc';

export const MOCK_ERROR_MESSAGE = 'Some error message';

export const baseImageUpdateRejection: TRPCErrorResponse = {
  error: {
    message: MOCK_ERROR_MESSAGE,
    code: -32603,
    data: {
      code: 'FORBIDDEN',
      httpStatus: 403,
      stack: 'AccessDenied',
      path: 'updateBaseImages'
    }
  }
};
