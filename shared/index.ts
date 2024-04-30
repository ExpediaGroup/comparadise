export const VISUAL_REGRESSION_CONTEXT = 'Visual Regression';
export const BASE_IMAGES_DIRECTORY = 'base-images';
export const BASE_IMAGE_NAME = 'base';
export const DIFF_IMAGE_NAME = 'diff';
export const NEW_IMAGE_NAME = 'new';
export const VISUAL_TESTS_FAILED_TO_EXECUTE =
  'Visual tests failed to execute successfully.';
export const ExitCode = Object.freeze({
  SUCCESS: 0,
  VISUAL_TESTS_FAILED_TO_EXECUTE: 1,
  VISUAL_DIFFS_DETECTED: 2,
});
