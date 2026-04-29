import { describe, expect, it } from 'bun:test';
import { PNG } from 'pngjs';
import { getDiffPixels, alignImagesToSameSize } from '../images';

function makePng(width: number, height: number, fill: number[]): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    png.data[idx] = fill[0]!;
    png.data[idx + 1] = fill[1]!;
    png.data[idx + 2] = fill[2]!;
    png.data[idx + 3] = fill[3]!;
  }
  return PNG.sync.write(png);
}

describe('getDiffPixels', () => {
  it('returns diffPixels: 0 for identical buffers', () => {
    const buf = makePng(10, 10, [255, 0, 0, 255]);
    const { diffPixels } = getDiffPixels(buf, buf);
    expect(diffPixels).toBe(0);
  });

  it('returns diffPixels > 0 for different buffers', () => {
    const base = makePng(10, 10, [255, 0, 0, 255]);
    const actual = makePng(10, 10, [0, 0, 255, 255]);
    const { diffPixels } = getDiffPixels(base, actual);
    expect(diffPixels).toBeGreaterThan(0);
  });

  it('handles size-mismatched buffers without error', () => {
    const base = makePng(10, 10, [255, 0, 0, 255]);
    const actual = makePng(20, 15, [255, 0, 0, 255]);
    expect(() => getDiffPixels(base, actual)).not.toThrow();
  });

  it('returns a diff PNG with correct dimensions for size-mismatched buffers', () => {
    const base = makePng(10, 10, [255, 0, 0, 255]);
    const actual = makePng(20, 15, [255, 0, 0, 255]);
    const { diff } = getDiffPixels(base, actual);
    expect(diff.width).toBe(20);
    expect(diff.height).toBe(15);
  });
});

describe('alignImagesToSameSize', () => {
  it('returns images with the max dimensions', () => {
    const a = new PNG({ width: 10, height: 5 });
    const b = new PNG({ width: 5, height: 10 });
    const [ra, rb] = alignImagesToSameSize(a, b);
    expect(ra.width).toBe(10);
    expect(ra.height).toBe(10);
    expect(rb.width).toBe(10);
    expect(rb.height).toBe(10);
  });
});
