import * as fs from 'fs';
import {
  alignImagesToSameSize,
  getDiffPixels as sharedGetDiffPixels,
  PIXELMATCH_OPTIONS,
  PixelMatchOptions
} from 'shared/images';

export type { PixelMatchOptions };

export function getDiffPixels(
  basePath: string,
  actualPath: string,
  pixelMatchOptions: PixelMatchOptions = PIXELMATCH_OPTIONS
) {
  return sharedGetDiffPixels(
    fs.readFileSync(basePath),
    fs.readFileSync(actualPath),
    pixelMatchOptions
  );
}

export { alignImagesToSameSize };
