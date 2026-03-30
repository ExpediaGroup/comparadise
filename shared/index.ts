export {
  s3Client,
  listObjects,
  listAllObjects,
  getObject,
  putObject,
  copyObject
} from './s3Client';

export const VISUAL_REGRESSION_CONTEXT = 'Visual Regression';
export const BASE_IMAGES_DIRECTORY = 'base-images';
export const NEW_IMAGES_DIRECTORY = 'new-images';
export const ORIGINAL_NEW_IMAGES_DIRECTORY = 'original-new-images';
export const BASE_IMAGE_NAME = 'base';
export const DIFF_IMAGE_NAME = 'diff';
export const NEW_IMAGE_NAME = 'new';
export const VISUAL_TESTS_FAILED_TO_EXECUTE =
  'Visual tests failed to execute successfully.';

export function encodeS3CopySource(bucket: string, key: string): string {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function filterNewImages(s3Paths: string[]): string[] {
  return s3Paths.filter(path =>
    path.match(new RegExp(`/${NEW_IMAGE_NAME}.png`))
  );
}

export function toBaseImagePath(
  path: string,
  sourceDirectory: string,
  hash: string
): string {
  return path
    .replace(`${sourceDirectory}/${hash}`, BASE_IMAGES_DIRECTORY)
    .replace(`${NEW_IMAGE_NAME}.png`, `${BASE_IMAGE_NAME}.png`);
}
