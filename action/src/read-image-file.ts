import { readFile } from 'fs/promises';

export async function readImageFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}
