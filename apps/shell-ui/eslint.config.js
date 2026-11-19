import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src/services/bindings'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // HR-Q1: no silently swallowed errors.
      'no-empty': ['error', { allowEmptyCatch: false }],
      // HR-S3: no dynamic code execution.
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // HR-A1: only the services layer may talk to the native host.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/services/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tauri-apps/*'],
              message: 'Only src/services may import the Tauri API (HR-A1).',
            },
          ],
        },
      ],
    },
  },
);
