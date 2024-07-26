import { baseExists } from '../screenshots';
import { existsSync } from 'fs';
import { expect } from '@jest/globals';

jest.mock('fs');

describe('screenshots', () => {
  it('should take a screenshot', () => {
    (existsSync as jest.Mock).mockReturnValue(true);
    const path = 'path/to/file';
    const result = baseExists(path);
    expect(result).toBe(true);
    expect(existsSync).toHaveBeenCalledWith(`${path}/base.png`);
  });
});
