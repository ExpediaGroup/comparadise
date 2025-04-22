import { Options } from 'tsup';

export default {
  clean: true,
  dts: true,
  entry: ['index.ts', 'match-screenshot.ts', 'create-base-image.ts'],
  noExternal: ['shared']
} satisfies Options;
