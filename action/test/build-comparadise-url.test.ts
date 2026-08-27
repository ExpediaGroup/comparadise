import { describe, expect, it, afterEach } from 'bun:test';
import { buildComparadiseUrl } from '../src/build-comparadise-url';

const inputs = {
  'bucket-name': 'some-bucket',
  'comparadise-host': 'https://comparadise.test',
  'commit-hash': 'sha-111',
  'use-base-images': 'true',
  'update-base-images-on-accept': 'true'
};

function setInputs(overrides: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries({ ...inputs, ...overrides })) {
    const envKey = `INPUT_${key.replace(/ /g, '_').toUpperCase()}`;
    if (value === undefined) {
      delete process.env[envKey];
    } else {
      process.env[envKey] = value;
    }
  }
}

const context = { repo: { owner: 'owner', repo: 'repo' } } as never;

describe('buildComparadiseUrl', () => {
  afterEach(() => {
    for (const key of Object.keys(inputs)) {
      delete process.env[`INPUT_${key.replace(/ /g, '_').toUpperCase()}`];
    }
  });

  it('reports useBaseImages from the action inputs by default', () => {
    setInputs();

    expect(buildComparadiseUrl(context)).toBe(
      'https://comparadise.test/?commitHash=sha-111&owner=owner&repo=repo&bucket=some-bucket&useBaseImages=true'
    );
  });

  it('lets manifest mode override useBaseImages to false', () => {
    setInputs();

    expect(buildComparadiseUrl(context, { useBaseImages: false })).toBe(
      'https://comparadise.test/?commitHash=sha-111&owner=owner&repo=repo&bucket=some-bucket&useBaseImages=false'
    );
  });

  it('reports false when the inputs opt out, with no override', () => {
    setInputs({ 'use-base-images': 'false' });

    expect(buildComparadiseUrl(context)).toBe(
      'https://comparadise.test/?commitHash=sha-111&owner=owner&repo=repo&bucket=some-bucket&useBaseImages=false'
    );
  });
});
