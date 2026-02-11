import { info, getInput, warning } from '@actions/core';
import sharp from 'sharp';
import * as path from 'path';
import { writeFile } from 'fs/promises';

/**
 * Get max dimensions from GitHub Action inputs
 * Returns undefined if not configured (to skip resizing)
 */
function getMaxDimensions(): { width: number; height: number } | undefined {
  const widthInput = getInput('max-image-width');
  const heightInput = getInput('max-image-height');

  // If neither input is provided, don't resize
  if (!widthInput && !heightInput) {
    return undefined;
  }

  const width = Number(widthInput);
  const height = Number(heightInput);

  if (isNaN(width) || isNaN(height)) {
    throw new Error(
      `Invalid max dimensions provided (width: ${widthInput}, height: ${heightInput})`
    );
  }

  return {
    width,
    height
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
    warning(
      `Could not resize ${path.basename(filePath)}: ${error}. Using original.`
    );
  }
}

/**
 * Batch resize images in parallel
 */
export async function resizeImages(filePaths: string[]) {
  const dimensions = getMaxDimensions();
  if (!dimensions) {
    info('Image resizing disabled (no max dimensions configured)');
    return;
  }

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
