import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { TEST_DB_PATH } from './tests/helpers/test-db';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Two suites run side by side:
 *
 *  - `unit`       pure functions, no database, fast.
 *  - `integration` the real Prisma client against a throwaway SQLite file built
 *                  from the production migrations (tests/helpers/test-db.ts).
 *
 * The integration suite points DATABASE_URL at that throwaway file *before* any
 * application module is imported, so `src/lib/db/client.ts` can never open the
 * client's real database.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.join(root, 'src') },
  },
  // tsconfig sets `jsx: preserve` so Next.js owns the JSX transform; the test
  // runner has to compile .tsx files itself, otherwise importing any component
  // module fails to parse. Vite 8 transforms with Oxc, hence `oxc` and not
  // `esbuild`.
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  test: {
    projects: [
      {
        resolve: { alias: { '@': path.join(root, 'src') } },
        oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          // Runs first, and keeps its own parallelism: it has no database.
          sequence: { groupOrder: 1 },
        },
      },
      {
        resolve: { alias: { '@': path.join(root, 'src') } },
        oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          env: {
            DATABASE_URL: `file:${TEST_DB_PATH}`,
            SESSION_SECRET: 'test-secret-0000000000000000000000000000000000000000',
            NODE_ENV: 'test',
          },
          globalSetup: ['tests/setup/global-setup.ts'],
          setupFiles: ['tests/setup/integration.ts'],
          // One fork, no file parallelism: the integration suite shares a
          // single SQLite file, so tests must not run against it concurrently.
          fileParallelism: false,
          isolate: false,
          maxWorkers: 1,
          // Runs after the unit suite.
          sequence: { groupOrder: 2 },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/actions/**'],
      exclude: ['src/generated/**', 'src/lib/utils/server-only.ts'],
    },
  },
});
