import type pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { getDiffPixels } from './images';

export type ComparisonOptions = Parameters<typeof pixelmatch>[5];

export interface ComparisonResult {
  diffPixels: number;
  /** Encoded PNG bytes, ready to save without importing PNGJS. */
  diffImage: Uint8Array;
}

/**
 * Compare two existing PNG files in Node without Cypress or a test runner.
 * Uses the existing Comparadise defaults when options are omitted.
 * Does not modify inputs or write output files. The caller owns capture,
 * missing-reference policy, assertions, artifact names, and publishing.
 *
 * @param basePath - Path to the reference PNG.
 * @param actualPath - Path to the captured PNG.
 * @param options - Optional Pixelmatch comparison settings.
 * @returns The mismatch count and encoded diff PNG.
 * @throws If either input file is missing or invalid.
 * @example
 * import { writeFileSync } from 'node:fs';
 * import { compareImages } from 'comparadise-utils/compare.js';
 *
 * const { diffPixels, diffImage } = compareImages('base.png', 'new.png', {
 *   threshold: 0.3
 * });
 * if (diffPixels > 0) {
 *   writeFileSync('diff.png', diffImage);
 * }
 */
export function compareImages(
  basePath: string,
  actualPath: string,
  options?: ComparisonOptions
): ComparisonResult {
  const { diffPixels, diff } = getDiffPixels(basePath, actualPath, options);
  return { diffPixels, diffImage: PNG.sync.write(diff) };
}
