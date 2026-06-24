import { describe, expect, it } from 'bun:test';
import { diffPng } from '../src/diff-png';
import { PNG } from 'pngjs';
import { readFileSync } from 'fs';
import { join } from 'path';

function makeSolidPng(
  width: number,
  height: number,
  rgba: [number, number, number, number]
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = rgba[0];
      png.data[idx + 1] = rgba[1];
      png.data[idx + 2] = rgba[2];
      png.data[idx + 3] = rgba[3];
    }
  }
  return PNG.sync.write(png);
}

describe('diffPng', () => {
  it('returns a valid PNG buffer', () => {
    const base = makeSolidPng(10, 10, [255, 0, 0, 255]);
    const actual = makeSolidPng(10, 10, [0, 255, 0, 255]);

    const result = diffPng(base, actual);

    const parsed = PNG.sync.read(result);
    expect(parsed.width).toBe(10);
    expect(parsed.height).toBe(10);
  });

  it('returns identical-sized output when inputs match', () => {
    const image = makeSolidPng(20, 15, [100, 100, 100, 255]);

    const result = diffPng(image, image);

    const parsed = PNG.sync.read(result);
    expect(parsed.width).toBe(20);
    expect(parsed.height).toBe(15);
  });

  it('handles different-sized inputs by expanding to max dimensions', () => {
    const small = makeSolidPng(5, 5, [255, 0, 0, 255]);
    const large = makeSolidPng(10, 8, [0, 255, 0, 255]);

    const result = diffPng(small, large);

    const parsed = PNG.sync.read(result);
    expect(parsed.width).toBe(10);
    expect(parsed.height).toBe(8);
  });

  it('works with a real PNG fixture', () => {
    const fixture = readFileSync(join(__dirname, 'fixtures/expedia.png'));
    const modified = makeSolidPng(
      PNG.sync.read(fixture).width,
      PNG.sync.read(fixture).height,
      [0, 0, 0, 255]
    );

    const result = diffPng(fixture, modified);

    const parsed = PNG.sync.read(result);
    expect(parsed.width).toBe(PNG.sync.read(fixture).width);
    expect(parsed.data.length).toBeGreaterThan(0);
  });
});
