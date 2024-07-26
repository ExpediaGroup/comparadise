import { TRPCError } from '@trpc/server';
import { join, parse } from 'path';
import { groupBy } from 'lodash';
import { NEW_IMAGE_NAME, NEW_IMAGES_DIRECTORY } from 'shared';
import { getKeysFromS3 } from './getKeysFromS3';

export const getGroupedKeys = async (hash: string, bucket: string) => {
  const keys = await getKeysFromS3(hash, bucket);
  if (!keys.length) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message:
        'The commit hash was not associated with any visual regression test failures.'
    });
  }

  const imageObjects = keys.map(parse);
  const groupedImages = groupBy(imageObjects, 'dir');
  const groupedKeys = Object.keys(groupedImages)
    .filter(key => {
      const groupedImage = groupedImages[key];
      return (
        groupedImage &&
        (groupedImage.length > 1 ||
          groupedImage.find(item => item.name === NEW_IMAGE_NAME))
      );
    })
    .map(key => ({
      title: getPathFromKey(key),
      keys: groupedImages[key]?.map(({ base, dir }) => join(dir, base))
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

const getPathFromKey = (path: string) => {
  const trimmedPath = path.replace(`${NEW_IMAGES_DIRECTORY}/`, '');

  return trimmedPath.slice(trimmedPath.indexOf('/') + 1);
};
