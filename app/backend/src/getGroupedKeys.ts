import { S3Client } from './s3Client';
import {GetGroupedKeysInput} from "./schema";
import {TRPCError} from "@trpc/server";
import { join, parse } from 'path';
import {groupBy} from "lodash";
import {NEW_IMAGE_NAME} from "shared";

export const getGroupedKeys = async ({ hash, bucket }: GetGroupedKeysInput) => {
  const response = await S3Client.listObjectsV2({
    Bucket: bucket,
    Prefix: hash
  });

  const keys = response?.Contents?.map(content => content.Key ?? '').filter(path => path && !path.includes('actions-runner'));
  if (!keys) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'The commit hash was not associated with any visual regression test failures.'
    });
  }

  const imageObjects = keys.map(parse);
  const groupedImages = groupBy(imageObjects, 'dir');
  const groupedKeys = Object.keys(groupedImages)
    .filter(key => groupedImages[key].length > 1 || groupedImages[key].find(item => item.name === NEW_IMAGE_NAME))
    .map((key, index) => ({
      page: index + 1,
      keys: groupedImages[key].map(({ base, dir }) => join(dir, base))
    }));

  if (!groupedKeys.length) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message:
          'There was no new or diff images associated with the commit hash.\nThis might be because the tests failed before a picture could be taken and it could be compared to the base.'
    });
  }

  return groupedKeys;
};
