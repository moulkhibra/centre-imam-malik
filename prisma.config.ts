import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

const ROOT = import.meta.dirname;

/**
 * Prisma CLI configuration.
 *
 * The database connection URL is intentionally read via process.env (not the
 * typed `env()` helper) so that commands which do not need a live connection
 * (e.g. `prisma generate` during CI type-checks) still work.
 */
export default defineConfig({
  schema: path.join(ROOT, 'prisma', 'schema.prisma'),
  migrations: {
    path: path.join(ROOT, 'prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./prisma/data/centre.db',
  },
});
