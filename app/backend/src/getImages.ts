import { getBase64StringFromS3 } from './getBase64StringFromS3';
import {GetImagesInput} from './schema';
import {parse} from "path";

export const getImages = async ({ keys, bucket }: GetImagesInput) => {
  return Promise.all(keys.map(async key => ({
    path: getPathFromKey(key),
    name: parse(key).name,
    image: await getBase64StringFromS3(key, bucket)
  })))
};

const getPathFromKey = (path: string) => {
  const pathWithoutFileName = parse(path).dir;
  return pathWithoutFileName.slice(pathWithoutFileName.indexOf('/') + 1);
};
