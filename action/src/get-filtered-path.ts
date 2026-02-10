import * as path from 'path';
import { accessSync, constants } from 'fs';

/**
 * Filters PATH to only include accessible directories.
 * This avoids permission errors when @actions/exec tries to resolve executables.
 */
export const getFilteredPath = (): string => {
  const originalPath = process.env.PATH || '';
  const pathDirs = originalPath.split(path.delimiter);

  const cleanDirs = pathDirs.filter(dir => {
    try {
      // Check if we can access this directory
      accessSync(dir, constants.R_OK);
      return true;
    } catch {
      // Skip directories we can't read
      return false;
    }
  });

  return cleanDirs.join(path.delimiter);
};
