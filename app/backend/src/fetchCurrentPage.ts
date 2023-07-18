import { getBase64StringFromS3 } from './getBase64StringFromS3';
import { FetchCurrentPageInput } from './schema';
import { parse } from 'path';
import { getGroupedKeys } from './getGroupedKeys';
import { TRPCError } from '@trpc/server';

export const fetchCurrentPage = async ({
  hash,
  bucket,
  page,
}: FetchCurrentPageInput) => {
  const paginatedKeys = await getGroupedKeys(hash, bucket);
  const currentPage = paginatedKeys[page - 1];
  if (!currentPage?.keys) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Page ${page} does not exist. Only ${paginatedKeys.length} pages were found.`,
    });
  }
  const { keys, title } = currentPage;
  const images = await Promise.all(
    keys.map(async key => ({
      name: parse(key).name,
      base64: await getBase64StringFromS3(key, bucket),
    })),
  );
  const nextPage = page < paginatedKeys.length ? page + 1 : undefined;
  return {
    title,
    images,
    nextPage,
  };
};
