import { info, getInput } from '@actions/core';
import sharp from 'sharp';
import * as path from 'path';
import { writeFile } from 'fs/promises';

export const DEFAULT_MAX_WIDTH = 1500;
export const DEFAULT_MAX_HEIGHT = 1500;

/**
 * Get max dimensions from GitHub Action inputs or use defaults
 */
function getMaxDimensions() {
  const width = Number(getInput('max-image-width'));
  const height = Number(getInput('max-image-height'));

  return {
    width: !width || isNaN(width) ? DEFAULT_MAX_WIDTH : width,
    height: !height || isNaN(height) ? DEFAULT_MAX_HEIGHT : height
  };
}

/**
 * Resize image if it exceeds max dimensions
 * Returns the file path (original or resized)
 */
export async function resizeImageIfNeeded(
  filePath: string,
  maxWidth: number,
  maxHeight: number
) {
  try {
    const metadata = await sharp(filePath).metadata();

    const originalWidth = metadata.width ?? 0;
    const originalHeight = metadata.height ?? 0;

    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return filePath;
    }

    // Read, resize, and get buffer in one pipeline
    const resizedBuffer = await sharp(filePath)
      .resize(maxWidth, maxHeight, {
        fit: 'inside', // Fit within bounds, maintain aspect ratio
        withoutEnlargement: true // Don't upscale if smaller
      })
      .png({
        compressionLevel: 6, // Balance between quality and file size (0-9)
        quality: 90 // PNG quality (0-100)
      })
      .toBuffer();

    // Write buffer directly back to original file path (in-place)
    await writeFile(filePath, resizedBuffer);
  } catch (error) {
    info(
      `Warning: Could not resize ${path.basename(filePath)}: ${error}. Using original.`
    );
  }
}

/**
 * Batch resize images in parallel
 */
export async function resizeImages(filePaths: string[]) {
  const dimensions = getMaxDimensions();
  const width = dimensions.width;
  const height = dimensions.height;

  info(
    `Starting resize of ${filePaths.length} image(s) with max dimensions ${width}x${height}`
  );
  await Promise.all(
    filePaths.map(filePath => resizeImageIfNeeded(filePath, width, height))
  );
  info(`Completed resize of ${filePaths.length} image(s)`);
}
