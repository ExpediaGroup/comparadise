import { expect } from '@jest/globals';

import { createImageFileName } from '../files';

describe('createImageFileName', () => {
  it('should build image file name correctly', () => {
    const path = 'path/to/file';
    const result = createImageFileName(path, 'base');
    expect(result).toEqual(`${path}/base.png`);
  });
});
