export function createImageFileName(path: string, type: string) {
  let newPath = path;
  if (path.startsWith('/')) {
    newPath = `.${path}`;
  }
  return `${newPath}/${type}.png`;
}
