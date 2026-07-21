import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'src/data/*.generated.json'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Spyclaudio não persiste estado no navegador.' },
        { name: 'sessionStorage', message: 'Spyclaudio não persiste estado no navegador.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use src/game/rng.ts (crypto.getRandomValues).' },
        { object: 'window', property: 'localStorage', message: 'Spyclaudio não persiste estado no navegador.' },
        { object: 'window', property: 'sessionStorage', message: 'Spyclaudio não persiste estado no navegador.' },
      ],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}', 'vitest.config.ts', 'playwright.config.ts', 'vite.config.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-restricted-properties': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
