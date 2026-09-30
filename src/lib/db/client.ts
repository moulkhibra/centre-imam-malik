import '@/lib/utils/server-only';
import path from 'node:path';
import fs from 'node:fs';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * Resolves the absolute SQLite database path from DATABASE_URL.
 *
 * Relative `file:` URLs are resolved against the project root, not the process
 * working directory, so the same database is used whether the app is started
 * by `start.bat`, by the installer, or by a test runner from a subfolder.
 */
export function resolveDatabasePath(url: string | undefined): string {
  const raw = url ?? 'file:./prisma/data/centre.db';
  const withoutScheme = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  const absolute = path.isAbsolute(withoutScheme)
    ? withoutScheme
    // turbopackIgnore: the path is runtime data (the SQLite file lives beside the
    // installation), not a bundled asset, so file tracing must not walk it.
    : path.join(/* turbopackIgnore: true */ process.cwd(), withoutScheme);

  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  return absolute;
}

function createClient(): PrismaClient {
  const dbPath = resolveDatabasePath(process.env.DATABASE_URL);
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

type PrismaClientSingleton = {
  prisma: PrismaClient | undefined;
};

const globalForPrisma = globalThis as unknown as PrismaClientSingleton;

/**
 * Reuse the client across hot reloads in development to avoid exhausting
 * SQLite connections.
 */
export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
