import * as fs from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const PIXELMATCH_OPTIONS = {
  threshold: 0.3
};

const createImageResizer = (width: number, height: number) => (source: any) => {
  const resized = new PNG({ width, height, fill: true });
  PNG.bitblt(source, resized, 0, 0, source.width, source.height, 0, 0);
  return resized;
};

const fillSizeDifference = (width: number, height: number) => (image: any) => {
  const inArea = (x: number, y: number) => y > height || x > width;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (inArea(x, y)) {
        const idx = (image.width * y + x) << 2;
        image.data[idx] = 0;
        image.data[idx + 1] = 0;
        image.data[idx + 2] = 0;
        image.data[idx + 3] = 64;
      }
    }
  }
  return image;
};

function alignImagesToSameSize(firstImage: any, secondImage: any) {
  // Keep original sizes to fill extended area later
  const firstImageWidth = firstImage.width;
  const firstImageHeight = firstImage.height;
  const secondImageWidth = secondImage.width;
  const secondImageHeight = secondImage.height;
  // Calculate biggest common values
  const resizeToSameSize = createImageResizer(Math.max(firstImageWidth, secondImageWidth), Math.max(firstImageHeight, secondImageHeight));
  // Resize both images
  const resizedFirst = resizeToSameSize(firstImage);
  const resizedSecond = resizeToSameSize(secondImage);
  // Fill resized area with black transparent pixels
  return [
    fillSizeDifference(firstImageWidth, firstImageHeight)(resizedFirst),
    fillSizeDifference(secondImageWidth, secondImageHeight)(resizedSecond)
  ];
}

export function getDiffPixels(basePath: string, actualPath: string) {
  const rawBase = PNG.sync.read(fs.readFileSync(basePath));
  const rawActual = PNG.sync.read(fs.readFileSync(actualPath));

  const hasSizeMismatch = rawBase.height !== rawActual.height || rawBase.width !== rawActual.width;

  const [base, actual] = hasSizeMismatch ? alignImagesToSameSize(rawBase, rawActual) : [rawBase, rawActual];

  const diff = new PNG({ width: base.width, height: base.height });

  const diffPixels = pixelmatch(actual.data, base.data, diff.data, diff.width, diff.height, PIXELMATCH_OPTIONS);

  return { diffPixels, diff };
}
