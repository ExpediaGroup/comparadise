import { describe, expect, it } from 'bun:test';
import { computeChangeset } from '../src/changeset';

describe('computeChangeset', () => {
  it('returns empty changeset when manifests are identical', () => {
    const manifest = {
      'components/Button/screenshot.png': 'abc123',
      'pages/Home/screenshot.png': 'def456'
    };

    const result = computeChangeset(manifest, manifest);

    expect(result).toEqual({});
  });

  it('detects changed screenshots', () => {
    const base = {
      'components/Button/screenshot.png': 'abc123',
      'pages/Home/screenshot.png': 'def456'
    };
    const pr = {
      'components/Button/screenshot.png': 'newHash',
      'pages/Home/screenshot.png': 'def456'
    };

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      'components/Button/screenshot.png': 'newHash'
    });
  });

  it('detects added screenshots', () => {
    const base = {
      'pages/Home/screenshot.png': 'def456'
    };
    const pr = {
      'pages/Home/screenshot.png': 'def456',
      'components/Modal/screenshot.png': 'ghi789'
    };

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      'components/Modal/screenshot.png': 'ghi789'
    });
  });

  it('detects deleted screenshots as null', () => {
    const base = {
      'components/Button/screenshot.png': 'abc123',
      'pages/Home/screenshot.png': 'def456'
    };
    const pr = {
      'pages/Home/screenshot.png': 'def456'
    };

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      'components/Button/screenshot.png': null
    });
  });

  it('handles multiple changes of different types simultaneously', () => {
    const base = {
      'unchanged/screenshot.png': 'same',
      'changed/screenshot.png': 'oldHash',
      'deleted/screenshot.png': 'willBeRemoved'
    };
    const pr = {
      'unchanged/screenshot.png': 'same',
      'changed/screenshot.png': 'newHash',
      'added/screenshot.png': 'brandNew'
    };

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      'changed/screenshot.png': 'newHash',
      'deleted/screenshot.png': null,
      'added/screenshot.png': 'brandNew'
    });
  });

  it('returns all entries as additions when base is empty', () => {
    const base = {};
    const pr = {
      'a/screenshot.png': 'hash1',
      'b/screenshot.png': 'hash2'
    };

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      'a/screenshot.png': 'hash1',
      'b/screenshot.png': 'hash2'
    });
  });

  it('returns all entries as deletions when PR is empty', () => {
    const base = {
      'a/screenshot.png': 'hash1',
      'b/screenshot.png': 'hash2'
    };
    const pr = {};

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      'a/screenshot.png': null,
      'b/screenshot.png': null
    });
  });
});
