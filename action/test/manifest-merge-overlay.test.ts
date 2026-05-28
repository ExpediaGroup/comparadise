import { describe, expect, it } from 'bun:test';
import {
  overlayChangeset,
  detectStaleConflicts
} from '../src/manifest-merge-overlay';
import type { Changeset, Manifest } from '../src/manifest-s3';

describe('overlayChangeset', () => {
  it('returns the parent manifest unchanged when the changeset is empty', () => {
    const parent: Manifest = { Button: 'h1', Modal: 'h2' };
    const changeset: Changeset = { _headSha: 'sha' };

    expect(overlayChangeset(parent, changeset)).toEqual(parent);
  });

  it('adds new (non-null) entries from the changeset', () => {
    const parent: Manifest = { Button: 'h1' };
    const changeset: Changeset = { _headSha: 'sha', NewThing: 'h-new' };

    expect(overlayChangeset(parent, changeset)).toEqual({
      Button: 'h1',
      NewThing: 'h-new'
    });
  });

  it('updates existing entries when the changeset provides a new hash', () => {
    const parent: Manifest = { Button: 'h1', Modal: 'h2' };
    const changeset: Changeset = { _headSha: 'sha', Button: 'h1-new' };

    expect(overlayChangeset(parent, changeset)).toEqual({
      Button: 'h1-new',
      Modal: 'h2'
    });
  });

  it('removes entries when the changeset value is null', () => {
    const parent: Manifest = { Button: 'h1', Removed: 'h-old' };
    const changeset: Changeset = { _headSha: 'sha', Removed: null };

    expect(overlayChangeset(parent, changeset)).toEqual({ Button: 'h1' });
  });

  it('ignores the _headSha metadata field when overlaying', () => {
    const parent: Manifest = { Button: 'h1' };
    const changeset: Changeset = { _headSha: 'some-sha-not-a-path' };

    const result = overlayChangeset(parent, changeset);
    expect(result).not.toHaveProperty('_headSha');
    expect(result).toEqual(parent);
  });

  it('handles a mix of additions, updates, and deletions', () => {
    const parent: Manifest = { A: 'a1', B: 'b1', C: 'c1' };
    const changeset: Changeset = {
      _headSha: 'sha',
      A: 'a2',
      B: null,
      D: 'd1'
    };

    expect(overlayChangeset(parent, changeset)).toEqual({
      A: 'a2',
      C: 'c1',
      D: 'd1'
    });
  });

  it('does not mutate the parent manifest', () => {
    const parent: Manifest = { Button: 'h1' };
    const changeset: Changeset = { _headSha: 'sha', Button: 'h2' };

    overlayChangeset(parent, changeset);

    expect(parent).toEqual({ Button: 'h1' });
  });
});

describe('detectStaleConflicts', () => {
  it('returns an empty array when head and parent manifests match for all changeset paths', () => {
    const headManifest: Manifest = { Button: 'h1', Modal: 'h2' };
    const parentManifest: Manifest = { Button: 'h1', Modal: 'h2' };
    const changeset: Changeset = {
      _headSha: 'sha',
      Button: 'h-pr',
      Modal: null
    };

    expect(
      detectStaleConflicts(headManifest, parentManifest, changeset)
    ).toEqual([]);
  });

  it('returns paths whose hash differs between head and parent manifests', () => {
    const headManifest: Manifest = { Button: 'h1', Modal: 'h2' };
    const parentManifest: Manifest = { Button: 'h1-changed', Modal: 'h2' };
    const changeset: Changeset = { _headSha: 'sha', Button: 'h-pr' };

    expect(
      detectStaleConflicts(headManifest, parentManifest, changeset)
    ).toEqual(['Button']);
  });

  it('treats a path missing in one manifest as a conflict', () => {
    const headManifest: Manifest = { Button: 'h1' };
    const parentManifest: Manifest = {};
    const changeset: Changeset = { _headSha: 'sha', Button: null };

    expect(
      detectStaleConflicts(headManifest, parentManifest, changeset)
    ).toEqual(['Button']);
  });

  it('only checks paths included in the changeset (not all manifest paths)', () => {
    const headManifest: Manifest = { Button: 'h1', Other: 'o1' };
    const parentManifest: Manifest = { Button: 'h1', Other: 'o2-different' };
    const changeset: Changeset = { _headSha: 'sha', Button: 'h-pr' };

    // 'Other' differs but isn't in the changeset, so it's not a conflict
    expect(
      detectStaleConflicts(headManifest, parentManifest, changeset)
    ).toEqual([]);
  });

  it('ignores the _headSha metadata field', () => {
    const headManifest: Manifest = {};
    const parentManifest: Manifest = {};
    const changeset: Changeset = { _headSha: 'some-sha' };

    expect(
      detectStaleConflicts(headManifest, parentManifest, changeset)
    ).toEqual([]);
  });

  it('returns multiple conflicting paths', () => {
    const headManifest: Manifest = { A: 'a1', B: 'b1', C: 'c1' };
    const parentManifest: Manifest = { A: 'a2', B: 'b1', C: 'c2' };
    const changeset: Changeset = {
      _headSha: 'sha',
      A: 'a-pr',
      B: 'b-pr',
      C: 'c-pr'
    };

    expect(
      detectStaleConflicts(headManifest, parentManifest, changeset)
    ).toEqual(['A', 'C']);
  });
});
