import { readdir, readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

const actionDir = import.meta.dir;
const repoRoot = resolve(actionDir, '..');
const outdir = resolve(actionDir, 'dist');
const stableRoot = '/comparadise';

const result = await Bun.build({
  entrypoints: [
    resolve(actionDir, 'src/main.ts'),
    resolve(actionDir, 'src/post.ts')
  ],
  outdir,
  sourcemap: 'linked',
  target: 'node'
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

for (const file of await readdir(outdir)) {
  const path = resolve(outdir, file);
  if (file.endsWith('.js')) {
    const source = await readFile(path, 'utf8');
    const normalized = source
      .replaceAll(repoRoot, stableRoot)
      .replace(/^\/\/# debugId=.*\n/m, '');
    await writeFile(path, normalized);
  } else if (file.endsWith('.js.map')) {
    const map = JSON.parse(await readFile(path, 'utf8')) as Record<
      string,
      unknown
    >;
    delete map.debugId;
    await writeFile(path, JSON.stringify(map).replaceAll(repoRoot, stableRoot));
  }
}
