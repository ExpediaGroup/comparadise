import { describe, expect, it } from 'bun:test';
import { computeChangeset } from '../src/changeset';

describe('computeChangeset', () => {
  it('returns empty changeset when manifests are identical', () => {
    const manifest = {
      'components/Button': 'abc123',
      'pages/Home': 'def456'
    };

    const result = computeChangeset(manifest, manifest);

    expect(result).toEqual({});
  });

  it('detects changed screenshots', () => {
    const base = {
      'components/Button': 'abc123',
      'pages/Home': 'def456'
    };
    const pr = {
      'components/Button': 'newHash',
      'pages/Home': 'def456'
    };

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      'components/Button': 'newHash'
    });
  });

  it('detects added screenshots', () => {
    const base = {
      'pages/Home': 'def456'
    };
    const pr = {
      'pages/Home': 'def456',
      'components/Modal': 'ghi789'
    };

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      'components/Modal': 'ghi789'
    });
  });

  it('detects deleted screenshots as null', () => {
    const base = {
      'components/Button': 'abc123',
      'pages/Home': 'def456'
    };
    const pr = {
      'pages/Home': 'def456'
    };

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      'components/Button': null
    });
  });

  it('handles multiple changes of different types simultaneously', () => {
    const base = {
      unchanged: 'same',
      changed: 'oldHash',
      deleted: 'willBeRemoved'
    };
    const pr = {
      unchanged: 'same',
      changed: 'newHash',
      added: 'brandNew'
    };

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      changed: 'newHash',
      deleted: null,
      added: 'brandNew'
    });
  });

  it('returns all entries as additions when base is empty', () => {
    const base = {};
    const pr = {
      a: 'hash1',
      b: 'hash2'
    };

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      a: 'hash1',
      b: 'hash2'
    });
  });

  it('returns all entries as deletions when PR is empty', () => {
    const base = {
      a: 'hash1',
      b: 'hash2'
    };
    const pr = {};

    const result = computeChangeset(base, pr);

    expect(result).toEqual({
      a: null,
      b: null
    });
  });
});
