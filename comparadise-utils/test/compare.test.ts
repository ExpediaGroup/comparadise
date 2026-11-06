import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { diffPng } from '../compare';
import { getDiffPixels } from '../images';

const folders: string[] = [];

function image(value = 0, width = 3, height = 3, alpha = 255) {
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data.set([value, value, value, alpha], offset);
  }
  return PNG.sync.write(png);
}

afterEach(() => {
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true });
});

describe('runner-independent image comparison', () => {
  it('reports changed pixels and returns an encoded PNG', () => {
    const result = diffPng(image(), image(255));
    expect(result.diffPixels).toBe(9);
    expect(result.diffBuffer).toBeInstanceOf(Buffer);
    expect(PNG.sync.read(result.diffBuffer).width).toBe(3);
  });

  it('reports matching images without changing either input buffer', () => {
    const base = image();
    const actual = image();
    const before = [Buffer.from(base), Buffer.from(actual)] as const;
    expect(diffPng(base, actual).diffPixels).toBe(0);
    expect(base).toEqual(before[0]);
    expect(actual).toEqual(before[1]);
  });

  it('uses the action comparison defaults', () => {
    const base = image();
    const actual = image(100);
    expect(diffPng(base, actual).diffPixels).toBe(9);
    expect(diffPng(base, actual)).toEqual(
      diffPng(base, actual, {
        threshold: 0.1,
        alpha: 0.1,
        checkerboard: true,
        strictEdgeDetection: false,
        padding: { opacity: 0, boundaryOffset: 0 }
      })
    );
  });

  it('accepts explicit comparison thresholds', () => {
    const base = image();
    const actual = image(100);
    expect(diffPng(base, actual, { threshold: 0 }).diffPixels).toBe(9);
    expect(diffPng(base, actual, { threshold: 1 }).diffPixels).toBe(0);
  });

  it('expands different-sized images without scaling', () => {
    const result = diffPng(image(), image(0, 4));
    expect(result.diffPixels).toBeGreaterThan(0);
    expect(PNG.sync.read(result.diffBuffer).width).toBe(4);
  });

  it('propagates invalid PNG errors from either input', () => {
    const valid = image();
    const invalid = Buffer.from('invalid PNG');
    expect(() => diffPng(invalid, valid)).toThrow();
    expect(() => diffPng(valid, invalid)).toThrow();
  });

  it('matches existing counts and diff pixels with explicit padding settings', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'comparadise-compare-'));
    folders.push(folder);
    const basePath = path.join(folder, 'base.png');
    const actualPath = path.join(folder, 'new.png');
    const options = {
      threshold: 0.3,
      alpha: 0.1,
      includeAA: false,
      checkerboard: false
    };
    for (const [width, height] of [
      [3, 3],
      [4, 3],
      [6, 3],
      [3, 6],
      [6, 5],
      [2, 2],
      [2, 6]
    ]) {
      for (const alpha of [64, 255]) {
        const base = image(180);
        const actual = image(180, width, height, alpha);
        writeFileSync(basePath, base);
        writeFileSync(actualPath, actual);
        const existing = getDiffPixels(basePath, actualPath, options);
        const result = diffPng(base, actual, {
          threshold: options.threshold,
          alpha: options.alpha,
          checkerboard: options.checkerboard,
          strictEdgeDetection: options.includeAA,
          padding: { opacity: 64 / 255, boundaryOffset: 1 }
        });
        expect(result.diffPixels).toBe(existing.diffPixels);
        expect(result.diffBuffer).toEqual(PNG.sync.write(existing.diff));
      }
    }
  });
});
