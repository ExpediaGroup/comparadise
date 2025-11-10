import {
  configs,
  parser,
  plugin as typescriptEslintPlugin
} from 'typescript-eslint';
import eslintPluginReact from 'eslint-plugin-react';

export default [
  ...configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser,
      parserOptions: {
        project: true
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
      'eslint-plugin-react': eslintPluginReact
    },
    rules: {
      '@typescript-eslint/no-namespace': 'off'
    }
  },
  {
    ignores: [
      '**/.tsup',
      '**/dist',
      'docs',
      '**/public',
      'comparadise-utils/**/*.js'
    ]
  }
];
