import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const PIXELMATCH_OPTIONS = {
  alpha: 0.3,
  threshold: 0.5,
  includeAA: false
};

export interface DiffPngResult {
  diffBuffer: Buffer;
  diffPixels: number;
}

export function diffPng(
  baseBuffer: Buffer,
  actualBuffer: Buffer
): DiffPngResult {
  const rawBase = PNG.sync.read(baseBuffer);
  const rawActual = PNG.sync.read(actualBuffer);

  const width = Math.max(rawBase.width, rawActual.width);
  const height = Math.max(rawBase.height, rawActual.height);

  const base = ensureSize(rawBase, width, height);
  const actual = ensureSize(rawActual, width, height);

  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(
    actual.data,
    base.data,
    diff.data,
    width,
    height,
    PIXELMATCH_OPTIONS
  );

  return { diffBuffer: PNG.sync.write(diff), diffPixels };
}

function ensureSize(image: PNG, width: number, height: number): PNG {
  if (image.width === width && image.height === height) return image;

  const resized = new PNG({ width, height, fill: true });
  PNG.bitblt(image, resized, 0, 0, image.width, image.height, 0, 0);
  return resized;
}
