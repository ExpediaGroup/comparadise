import { createHash } from 'crypto';
import { readFile } from 'fs/promises';

export async function hashFile(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return createHash('md5').update(data).digest('hex');
}
