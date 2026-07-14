import { describe, expect, it } from 'bun:test';
import path from 'path';
import { hashFile } from '../src/hash';

const fixturePath = path.join(__dirname, 'fixtures', 'expedia.png');

describe('hashFile', () => {
  it('returns the MD5 hex digest of a file', async () => {
    const hash = await hashFile(fixturePath);
    expect(hash).toBe('158ab3365b62c5161a55515e7156d883');
  });
});
