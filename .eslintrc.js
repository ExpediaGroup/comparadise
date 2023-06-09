module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: ['plugin:react/recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 13,
    sourceType: 'module'
  },
  plugins: ['react', '@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-namespace': 'off',
    'operator-linebreak': 'off',
    'implicit-arrow-linebreak': 'off',
    'comma-dangle': 'off',
    'max-len': 'off',
    'jsx-a11y/alt-text': 'off',
    'no-console': 'off',
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    "@typescript-eslint/no-unused-vars": ['error', { ignoreRestSiblings: true }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'react/jsx-filename-extension': ['warn', { extensions: ['.tsx'] }],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['error'],
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'react/button-has-type': 'off',
    'arrow-body-style': 'off',
    'arrow-parens': 'off',
    'react/jsx-wrap-multilines': 'off',
    'react/jsx-one-expression-per-line': 'off',
    'react/jsx-closing-tag-location': 'off',
    'prefer-promise-reject-errors': 'off',
    'no-param-reassign': 'off',
    'react/require-default-props': 'off',
    semi: 'off',
    'object-curly-newline': 'off',
    quotes: 'off',
    'react/function-component-definition': 'off'
  },
  settings: {
    'import/resolver': {
      typescript: {}
    },
    react: {
      version: 'detect'
    }
  }
};
