/* eslint-disable @typescript-eslint/no-var-requires */
const typescriptEslint = require('typescript-eslint');
const eslintPluginReact = require('eslint-plugin-react');

module.exports = [
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
