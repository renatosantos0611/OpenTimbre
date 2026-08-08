// Root ESLint flat config. The only project-specific rule here is the
// core-boundary check: packages/core must never import electron or Angular
// (opentimbre-core-boundary) — everything else is @typescript-eslint's
// recommended baseline.
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'legacy/**'],
  },
  {
    files: ['**/*.ts', '**/*.cts'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['electron', 'electron/*', '@angular/*'],
        },
      ],
    },
  },
]
