import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface DiffPngOptions extends Omit<
  NonNullable<Parameters<typeof pixelmatch>[5]>,
  'includeAA'
> {
  /** Count anti-aliased pixels as differences. Defaults to false. */
  strictEdgeDetection?: boolean;
  /** Applies only when the image dimensions differ. */
  padding?: {
    /** Opacity of black fill in added image space, from 0 to 1. Defaults to 0. */
    opacity?: number;
    /**
     * Non-negative integer offset from the original width or height where padding
     * fill starts. Earlier added pixels remain transparent. Defaults to 0.
     */
    boundaryOffset?: number;
  };
}

export interface DiffPngResult {
  diffBuffer: Buffer;
  diffPixels: number;
}

type PaddingOptions = NonNullable<DiffPngOptions['padding']>;

/**
 * Compare two PNG buffers in Node without Cypress or a test runner.
 * Smaller images expand to the maximum width and height without scaling.
 * Added pixels are transparent unless padding.opacity specifies black fill.
 * Pixelmatch defaults apply, with strict edge detection disabled by default.
 * Does not modify inputs or access files. The caller owns capture,
 * missing-reference policy, assertions, artifact names, and publishing.
 *
 * @param baseBuffer - Encoded reference PNG.
 * @param actualBuffer - Encoded captured PNG.
 * @param options - Pixelmatch settings, strict edge detection, and padding fill.
 * @returns The mismatch count and encoded diff PNG.
 * @throws If either PNG is invalid, or resizing uses invalid padding options.
 * @example
 * import { readFileSync, writeFileSync } from 'node:fs';
 * import { diffPng } from 'comparadise-utils/diff-png';
 *
 * const { diffPixels, diffBuffer } = diffPng(
 *   readFileSync('base.png'),
 *   readFileSync('new.png'),
 *   {
 *     threshold: 0.3,
 *     alpha: 0.1,
 *     checkerboard: false,
 *     padding: { opacity: 64 / 255, boundaryOffset: 1 }
 *   }
 * );
 * if (diffPixels > 0) {
 *   writeFileSync('diff.png', diffBuffer);
 * }
 */
export function diffPng(
  baseBuffer: Buffer,
  actualBuffer: Buffer,
  options: DiffPngOptions = {}
): DiffPngResult {
  const {
    padding = {},
    strictEdgeDetection = false,
    ...pixelmatchOptions
  } = options;
  const rawBase = PNG.sync.read(baseBuffer);
  const rawActual = PNG.sync.read(actualBuffer);

  const width = Math.max(rawBase.width, rawActual.width);
  const height = Math.max(rawBase.height, rawActual.height);

  const prepareImage = (image: PNG) => {
    const resized = ensureSize(image, width, height);
    if (resized !== image) {
      fillPadding(resized, image, padding);
    }
    return resized;
  };
  const base = prepareImage(rawBase);
  const actual = prepareImage(rawActual);

  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(
    actual.data,
    base.data,
    diff.data,
    width,
    height,
    {
      ...pixelmatchOptions,
      includeAA: strictEdgeDetection
    }
  );

  return { diffBuffer: PNG.sync.write(diff), diffPixels };
}

function ensureSize(image: PNG, width: number, height: number): PNG {
  if (image.width === width && image.height === height) return image;

  const resized = new PNG({ width, height, fill: true });
  PNG.bitblt(image, resized, 0, 0, image.width, image.height, 0, 0);
  return resized;
}

function fillPadding(target: PNG, source: PNG, padding: PaddingOptions): void {
  const { opacity = 0, boundaryOffset = 0 } = padding;
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new RangeError('padding.opacity must be between 0 and 1.');
  }
  if (!Number.isInteger(boundaryOffset) || boundaryOffset < 0) {
    throw new RangeError(
      'padding.boundaryOffset must be a non-negative integer.'
    );
  }
  if (opacity === 0) return;

  const fillPixel = Buffer.from([0, 0, 0, Math.round(opacity * 255)]);
  for (let y = 0; y < target.height; y++) {
    const startX =
      y >= source.height + boundaryOffset ? 0 : source.width + boundaryOffset;
    if (startX < target.width) {
      target.data.fill(
        fillPixel,
        (y * target.width + startX) * 4,
        (y + 1) * target.width * 4
      );
    }
  }
}
