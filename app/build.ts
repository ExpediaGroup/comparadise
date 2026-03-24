import tailwindPlugin from 'bun-plugin-tailwind';

const result = await Bun.build({
  entrypoints: ['./public/index.html'],
  outdir: './dist',
  publicPath: '/',
  minify: true,
  plugins: [tailwindPlugin]
});

if (!result.success) {
  result.logs.forEach(log => console.error(log));
  process.exit(1);
}
