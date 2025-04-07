import { Options } from 'tsup';

export default {
  clean: true,
  dts: true,
  format: 'esm',
  outExtension: () => ({ js: '.js' }),
  entry: ['index.ts', 'match-screenshot.ts'],
  noExternal: ['shared']
} satisfies Options;
