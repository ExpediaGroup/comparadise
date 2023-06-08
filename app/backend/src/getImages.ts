import { getBase64StringFromS3 } from './getBase64StringFromS3';
import {GetImagesInput} from './schema';
import {parse} from "path";

export const getImages = async ({ keys, bucket }: GetImagesInput) => {
  return Promise.all(keys.map(async key => ({
    name: parse(key).name,
    base64: await getBase64StringFromS3(key, bucket)
  })))
};
