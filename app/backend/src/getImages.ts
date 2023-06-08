import { getBase64StringFromS3 } from './getBase64StringFromS3';
import {GetImagesInput} from './schema';
import {parse} from "path";
import {getGroupedKeys} from "./getGroupedKeys";

export const getImages = async ({ hash, bucket, cursor: page }: GetImagesInput) => {
  const paginatedKeys = await getGroupedKeys(hash, bucket);
  const { keys, title } = paginatedKeys[page - 1];
  const images = await Promise.all(keys.map(async key => ({
    name: parse(key).name,
    base64: await getBase64StringFromS3(key, bucket)
  })));
  const nextPage = page < paginatedKeys.length ? page + 1 : undefined;
  return {
    title,
    images,
    nextPage
  }
};
