import groupBy from 'lodash.groupby';
import { getBase64StringFromS3 } from './getBase64StringFromS3';
import { listAllS3PathsForHash } from './listAllS3PathsForHash';
import { BASE_IMAGE_NAME, DIFF_IMAGE_NAME, NEW_IMAGE_NAME } from './constants';
import { parse } from 'path';
import { TRPCError } from '@trpc/server';

type ImageName = typeof BASE_IMAGE_NAME | typeof DIFF_IMAGE_NAME | typeof NEW_IMAGE_NAME;

export const getGroupedImages = async (hash: string, bucket: string) => {
  const keys = await listAllS3PathsForHash(hash, bucket);

  if (!keys) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'The commit hash was not associated with any visual regression test failures.'
    });
  }
  const groupedImages = await getGroupedByImagesObject(keys, bucket);
  if (!groupedImages.length) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message:
        'There was no new or diff images associated with the commit hash.\nThis might be because the tests failed before a picture could be taken and it could be compared to the base.'
    });
  }

  return groupedImages;
};

const getGroupedByImagesObject = async (keys: string[], bucket: string) => {
  const base64Images = await Promise.all(keys.map(key => getBase64StringFromS3(key, bucket)));
  const responseEntries = getResponseEntries(keys, base64Images);

  const groupedResponseEntries = groupBy(responseEntries, 'key');
  return Object.keys(groupedResponseEntries)
    .map(key => ({
      name: key,
      entries: groupedResponseEntries[key]
    }))
    .filter(test => test.entries.length > 1 || test.entries.find(responseEntry => responseEntry.name === NEW_IMAGE_NAME));
};

const getResponseEntries = (keys: string[], base64Images: string[]) =>
  keys.map((imagePath, index) => ({
    key: getKeyFromPath(imagePath),
    name: getImageNameFromPath(imagePath),
    image: base64Images[index]
  }));

const getImageNameFromPath = (path: string) => parse(path).name as ImageName;

const getKeyFromPath = (path: string) => {
  const pathWithoutFileName = parse(path).dir;
  return pathWithoutFileName.slice(pathWithoutFileName.indexOf('/') + 1);
};
