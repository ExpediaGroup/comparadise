import { FetchCurrentPageInput, fileNameSchema } from './schema';
import { parse } from 'path';
import { getGroupedKeys } from './getGroupedKeys';
import { TRPCError } from '@trpc/server';
import { getKeysFromS3, s3Client } from 'shared/s3';
import type { S3Operations } from 'shared/s3';

const defaultS3: Pick<S3Operations, 'getKeysFromS3' | 'client'> = {
  getKeysFromS3,
  client: s3Client
};
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const oneHour = 3600;

async function getTemporaryObjectUrl(
  key: string,
  bucket: string,
  s3: Pick<S3Operations, 'client'>
) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3.client, command, { expiresIn: oneHour });
}

export const fetchCurrentPage = async (
  { hash, bucket, page }: FetchCurrentPageInput,
  s3: Pick<S3Operations, 'getKeysFromS3' | 'client'> = defaultS3
) => {
  const paginatedKeys = await getGroupedKeys(hash, bucket, s3);
  const currentPage = paginatedKeys[page - 1];
  if (!currentPage?.keys) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Page ${page} does not exist. Only ${paginatedKeys.length} pages were found.`,
      cause: { event: 'PAGE_NOT_FOUND' }
    });
  }
  const { keys, title } = currentPage;
  const images = await Promise.all(
    keys.map(async key => {
      const result = fileNameSchema.safeParse(parse(key).name);
      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid file name: ${key}. ${result.error.message}`,
          cause: { event: 'INVALID_FILE_NAME' }
        });
      }

      return {
        name: result.data,
        url: await getTemporaryObjectUrl(key, bucket, s3)
      };
    })
  );
  const nextPage = page < paginatedKeys.length ? page + 1 : undefined;
  return {
    title,
    images,
    nextPage,
    totalPages: paginatedKeys.length
  };
};
