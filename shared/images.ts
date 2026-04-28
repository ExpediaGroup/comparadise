import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export type PixelMatchOptions = Parameters<typeof pixelmatch>[5];

export const PIXELMATCH_OPTIONS: PixelMatchOptions = {
  alpha: 0.3,
  threshold: 0.5,
  includeAA: false
};

const createImageResizer = (width: number, height: number) => (source: PNG) => {
  const resized = new PNG({ width, height, fill: true });
  PNG.bitblt(source, resized, 0, 0, source.width, source.height, 0, 0);
  return resized;
};

const fillSizeDifference = (width: number, height: number) => (image: PNG) => {
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

export function alignImagesToSameSize(
  firstImage: PNG,
  secondImage: PNG
): [PNG, PNG] {
  const firstImageWidth = firstImage.width;
  const firstImageHeight = firstImage.height;
  const secondImageWidth = secondImage.width;
  const secondImageHeight = secondImage.height;
  const resizeToSameSize = createImageResizer(
    Math.max(firstImageWidth, secondImageWidth),
    Math.max(firstImageHeight, secondImageHeight)
  );
  const resizedFirst = resizeToSameSize(firstImage);
  const resizedSecond = resizeToSameSize(secondImage);
  return [
    fillSizeDifference(firstImageWidth, firstImageHeight)(resizedFirst),
    fillSizeDifference(secondImageWidth, secondImageHeight)(resizedSecond)
  ];
}

export function getDiffPixels(
  base: Buffer,
  actual: Buffer,
  pixelMatchOptions: PixelMatchOptions = PIXELMATCH_OPTIONS
): { diffPixels: number; diff: PNG } {
  const rawBase = PNG.sync.read(base);
  const rawActual = PNG.sync.read(actual);

  const hasSizeMismatch =
    rawBase.height !== rawActual.height || rawBase.width !== rawActual.width;

  const [baseImg, actualImg] = hasSizeMismatch
    ? alignImagesToSameSize(rawBase, rawActual)
    : [rawBase, rawActual];

  const diff = new PNG({ width: baseImg.width, height: baseImg.height });

  const diffPixels = pixelmatch(
    actualImg.data,
    baseImg.data,
    diff.data,
    diff.width,
    diff.height,
    pixelMatchOptions
  );

  return { diffPixels, diff };
}
