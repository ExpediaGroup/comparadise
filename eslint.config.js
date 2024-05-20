// @ts-check

import typescriptEslint from 'typescript-eslint';
import eslintPluginReact from 'eslint-plugin-react';

export default [
  ...typescriptEslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        project: true
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint.plugin,
      'eslint-plugin-react': eslintPluginReact
    },
    rules: {
      '@typescript-eslint/no-namespace': 'off'
    }
  },
  {
    ignores: ['**/dist', 'docs']
  }
];
