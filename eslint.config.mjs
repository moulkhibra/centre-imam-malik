import next from 'eslint-config-next';
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Flat ESLint configuration.
 *
 * The Next.js presets provide TypeScript, React and jsx-a11y support. On top of
 * that we enforce the rules that protect a multi-tenant administration app:
 * never reach for `any`, never silence the compiler, and keep secrets out of
 * client bundles.
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/generated/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'verify/**',
      'public/**',
      'next-env.d.ts',
    ],
  },
  ...next,
  ...coreWebVitals,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'properties'],
    },
  },
  {
    // Client/server separation is enforced by the `server-only` runtime guard
    // plus tests/unit/server-boundaries.test.ts, which parses every file that
    // declares "use client" and fails if it reaches a server module. A lint
    // rule cannot distinguish a Client Component from a Server Component in
    // flat config, so the check lives where it can be precise.
  },
  {
    // Tests, verification scripts and the installer are CLI programs: printing
    // progress is their whole purpose.
    files: [
      'tests/**/*.{ts,tsx}',
      'scripts/**/*.{ts,tsx,mjs}',
      'prisma/seed*.ts',
      'e2e/**/*.{ts,tsx}',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },
];

export default config;
