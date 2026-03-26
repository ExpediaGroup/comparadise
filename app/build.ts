import tailwindPlugin from 'bun-plugin-tailwind';
import { rmSync } from 'fs';

rmSync('./dist', { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ['./public/index.html'],
  outdir: './dist',
  publicPath: '/',
  minify: true,
  plugins: [tailwindPlugin]
});

if (!result.success) {
  // eslint-disable-next-line no-console
  result.logs.forEach(log => console.error(log));
  process.exit(1);
}
