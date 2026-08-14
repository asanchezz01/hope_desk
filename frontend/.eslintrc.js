module.exports = {
  root: true,
  extends: ['expo', 'eslint:recommended'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      rules: { 'no-undef': 'off' },
    },
    {
      files: ['test/**/*', '**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}'],
      env: { jest: true },
    },
  ],
}
