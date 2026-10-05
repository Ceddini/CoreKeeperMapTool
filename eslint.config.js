import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'legacy/**',
      'dist/**',
      'dev-dist/**',
      'node_modules/**',
      'playwright-report/**',
      '.cache/**',
      'public/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      // The signals core tracks the running computation in a module variable.
      '@typescript-eslint/no-this-alias': 'off',
    },
  },
);
