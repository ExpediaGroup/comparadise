import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import sharp from 'sharp';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';

// Create a comprehensive mock for @actions/core to avoid conflicts with other tests
mock.module('@actions/core', () => ({
  info: mock(() => {}),
  getInput: mock(() => ''),
  setFailed: mock(() => {}),
  getBooleanInput: mock(() => false),
  getMultilineInput: mock(() => []),
  warning: mock()
}));

const imageUtils = await import('../src/image-utils');
const resizeImageIfNeeded = imageUtils.resizeImageIfNeeded;
const MAX_WIDTH = 1500;
const MAX_HEIGHT = 1500;

const TEST_DIR = join(import.meta.dir, 'temp-test-images');

describe('image-utils', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should not resize image within size limits', async () => {
    const testImagePath = join(TEST_DIR, 'small.png');

    // Create a small test image (500x500)
    await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    })
      .png()
      .toFile(testImagePath);

    const originalMetadata = await sharp(testImagePath).metadata();

    await resizeImageIfNeeded(testImagePath, MAX_WIDTH, MAX_HEIGHT);

    const newMetadata = await sharp(testImagePath).metadata();

    expect(newMetadata.width).toBe(originalMetadata.width);
    expect(newMetadata.height).toBe(originalMetadata.height);
  });

  it('should resize image exceeding width limit', async () => {
    const testImagePath = join(TEST_DIR, 'wide.png');

    // Create a wide test image (3000x1000)
    await sharp({
      create: {
        width: 3000,
        height: 1000,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 }
      }
    })
      .png()
      .toFile(testImagePath);

    await resizeImageIfNeeded(testImagePath, MAX_WIDTH, MAX_HEIGHT);

    const metadata = await sharp(testImagePath).metadata();

    expect(metadata.width).toBeLessThanOrEqual(MAX_WIDTH);
    expect(metadata.height).toBeLessThanOrEqual(MAX_HEIGHT);

    // Check aspect ratio is maintained
    const aspectRatio = 3000 / 1000;
    const newAspectRatio = (metadata.width ?? 0) / (metadata.height ?? 0);
    expect(Math.abs(aspectRatio - newAspectRatio)).toBeLessThan(0.01);
  });

  it('should resize image exceeding height limit', async () => {
    const testImagePath = join(TEST_DIR, 'tall.png');

    // Create a tall test image (1000x3000)
    await sharp({
      create: {
        width: 1000,
        height: 3000,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 }
      }
    })
      .png()
      .toFile(testImagePath);

    await resizeImageIfNeeded(testImagePath, MAX_WIDTH, MAX_HEIGHT);

    const metadata = await sharp(testImagePath).metadata();

    expect(metadata.width).toBeLessThanOrEqual(MAX_WIDTH);
    expect(metadata.height).toBeLessThanOrEqual(MAX_HEIGHT);

    // Check aspect ratio is maintained
    const aspectRatio = 1000 / 3000;
    const newAspectRatio = (metadata.width ?? 0) / (metadata.height ?? 0);
    expect(Math.abs(aspectRatio - newAspectRatio)).toBeLessThan(0.01);
  });

  it('should resize image exceeding both limits', async () => {
    const testImagePath = join(TEST_DIR, 'large.png');

    // Create a large test image (4000x4000)
    await sharp({
      create: {
        width: 4000,
        height: 4000,
        channels: 4,
        background: { r: 255, g: 255, b: 0, alpha: 1 }
      }
    })
      .png()
      .toFile(testImagePath);

    await resizeImageIfNeeded(testImagePath, MAX_WIDTH, MAX_HEIGHT);

    const metadata = await sharp(testImagePath).metadata();

    expect(metadata.width).toBeLessThanOrEqual(MAX_WIDTH);
    expect(metadata.height).toBeLessThanOrEqual(MAX_HEIGHT);
    expect(metadata.width).toBe(MAX_WIDTH);
    expect(metadata.height).toBe(MAX_HEIGHT);
  });

  it('should handle custom max dimensions', async () => {
    const testImagePath = join(TEST_DIR, 'custom.png');
    const customMax = 500;

    // Create a test image (2000x2000)
    await sharp({
      create: {
        width: 2000,
        height: 2000,
        channels: 4,
        background: { r: 255, g: 0, b: 255, alpha: 1 }
      }
    })
      .png()
      .toFile(testImagePath);

    await resizeImageIfNeeded(testImagePath, customMax, customMax);

    const metadata = await sharp(testImagePath).metadata();

    expect(metadata.width).toBeLessThanOrEqual(customMax);
    expect(metadata.height).toBeLessThanOrEqual(customMax);
    expect(metadata.width).toBe(customMax);
    expect(metadata.height).toBe(customMax);
  });
});

describe('resizeImages batch function', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should skip resizing when no max dimensions are configured', async () => {
    const testImagePath = join(TEST_DIR, 'large.png');

    // Create a large test image (3000x3000)
    await sharp({
      create: {
        width: 3000,
        height: 3000,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    })
      .png()
      .toFile(testImagePath);

    const originalMetadata = await sharp(testImagePath).metadata();

    // Import resizeImages dynamically to use mocked getInput
    const { resizeImages } = await import('../src/image-utils');
    await resizeImages([testImagePath]);

    const newMetadata = await sharp(testImagePath).metadata();

    // Image should not be resized (dimensions unchanged)
    expect(newMetadata.width).toBe(originalMetadata.width);
    expect(newMetadata.height).toBe(originalMetadata.height);
  });
});
