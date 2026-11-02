import { afterEach, describe, expect, it } from 'bun:test';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { compareImages } from '../compare';
import { getDiffPixels } from '../images';

const folders: string[] = [];

function fixture(value = 0, width = 3) {
  const folder = mkdtempSync(path.join(tmpdir(), 'comparadise-compare-'));
  folders.push(folder);
  const base = path.join(folder, 'base.png');
  const actual = path.join(folder, 'new.png');
  for (const [file, color, size] of [
    [base, 0, 3],
    [actual, value, width]
  ] as const) {
    const png = new PNG({ width: size, height: 3 });
    for (let offset = 0; offset < png.data.length; offset += 4) {
      png.data.set([color, color, color, 255], offset);
    }
    writeFileSync(file, PNG.sync.write(png));
  }
  return { folder, base, actual };
}

afterEach(() => {
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true });
});

describe('runner-independent image comparison', () => {
  it('reports changed pixels and returns an encoded PNG', () => {
    const { base, actual } = fixture(255);
    const result = compareImages(base, actual);
    expect(result.diffPixels).toBe(9);
    expect(result.diffImage).toBeInstanceOf(Uint8Array);
    expect(PNG.sync.read(Buffer.from(result.diffImage)).width).toBe(3);
  });

  it('reports matching images without changing either input or writing output files', () => {
    const { folder, base, actual } = fixture();
    const before = [readFileSync(base), readFileSync(actual)] as const;
    expect(compareImages(base, actual).diffPixels).toBe(0);
    expect(readFileSync(base)).toEqual(before[0]);
    expect(readFileSync(actual)).toEqual(before[1]);
    expect(readdirSync(folder).sort()).toEqual(['base.png', 'new.png']);
  });

  it('preserves the existing engine defaults and encoded diff', () => {
    const { base, actual } = fixture(100);
    const existing = getDiffPixels(base, actual);
    const result = compareImages(base, actual);
    expect(result.diffPixels).toBe(existing.diffPixels);
    expect(
      Buffer.from(result.diffImage).equals(PNG.sync.write(existing.diff))
    ).toBe(true);
  });

  it('passes explicit comparison options to the engine', () => {
    const { base, actual } = fixture(100);
    expect(compareImages(base, actual, { threshold: 0 }).diffPixels).toBe(9);
    expect(compareImages(base, actual, { threshold: 1 }).diffPixels).toBe(0);
  });

  it('preserves different-size image comparison', () => {
    const { base, actual } = fixture(0, 4);
    const result = compareImages(base, actual);
    expect(result.diffPixels).toBeGreaterThan(0);
    expect(PNG.sync.read(Buffer.from(result.diffImage)).width).toBe(4);
  });

  it('propagates missing and invalid image errors', () => {
    const { base, actual } = fixture();
    expect(() => compareImages(`${base}.missing`, actual)).toThrow();
    writeFileSync(base, 'invalid PNG');
    expect(() => compareImages(base, actual)).toThrow();
  });
});
