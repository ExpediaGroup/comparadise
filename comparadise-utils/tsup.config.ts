import { Options } from 'tsup';

export default {
    clean: true,
    dts: true,
    entry: ['index.ts', 'match-screenshot.ts'],
    noExternal: ['shared']
} satisfies Options
