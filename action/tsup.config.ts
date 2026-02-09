import { Options } from 'tsup';

export default {
  clean: true,
  entry: ['src/main.ts', 'src/post.ts'],
  sourcemap: true,
  noExternal: [/.*/]
} satisfies Options;
