export const VISUAL_REGRESSION_CONTEXT = 'Visual Regression';
export const BASE_IMAGES_DIRECTORY = 'base-images';
export const BASE_IMAGE_NAME = 'base';
export const DIFF_IMAGE_NAME = 'diff';
export const NEW_IMAGE_NAME = 'new';
export const ImageName = {
    BASE_IMAGE_NAME,
    DIFF_IMAGE_NAME,
    NEW_IMAGE_NAME
} as const;
export const UPDATE_BASE_IMAGES_ERROR_MESSAGE =
  'At least one non-visual status check has not passed on your PR. Please ensure all other checks have passed before updating base images!';
