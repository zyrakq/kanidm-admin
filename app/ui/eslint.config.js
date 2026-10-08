import js from '@eslint/js';
import lit from 'eslint-plugin-lit';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'logs',
      '*.log',
      'node_modules',
      'build',
      'dist',
      'dist-ssr',
      '*.local',
      '.vscode/*',
      '.env',
      'bun.lock',
      '**/*.min.js',
      '**/*.min.css',
      'src/features/localization/generated/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  lit.configs['flat/recommended'],
  prettierRecommended,
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { decorators: true },
      },
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
];
