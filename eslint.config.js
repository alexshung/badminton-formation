// ESLint flat config.
//
// This app is a deliberately build-free, multi-file "script tag" architecture:
// functions and constants are shared as implicit globals across files, and many
// are invoked only from inline HTML `onclick=` handlers. Cross-file / cross-HTML
// name resolution therefore isn't visible to ESLint, so we disable the rules that
// would produce noise from it (`no-undef`, and top-level `no-unused-vars`) while
// keeping the high-signal correctness rules from the recommended set
// (no-dupe-keys, no-redeclare, no-unreachable, no-fallthrough, valid-typeof, ...).
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'vendor/**', 'dist/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      'no-undef': 'off',
      // Only flag genuinely dead *local* variables; globals are shared across
      // files and HTML handlers, so reporting them would be all false positives.
      'no-unused-vars': ['warn', { vars: 'local', args: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    // Node tooling scripts.
    files: ['scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    // ESM Node scripts (headless agent driver). Uses top-level await + import.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
];
