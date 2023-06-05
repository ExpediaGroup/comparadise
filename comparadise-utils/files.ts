/**
 * Creates a file path that is relative to the root
 * @param {string} type - Value to append to fileName
 * @param {string} path - (optional) FileName which corresponds to a module Id
 * returns a string of just the prefix or the fileName prepended by the prefix
 */
export function createImageFileName(path: string, type: string) {
  let newPath = path;
  if (path.startsWith('/')) {
    newPath = `.${path}`;
  }
  return `${newPath}/${type}.png`;
}
