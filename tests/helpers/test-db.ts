import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Test database strategy.
 *
 * Integration tests run against a REAL SQLite database built from the real
 * migration files - never against a hand-written schema and never against the
 * production database. The file lives under `.tmp/` and is recreated from
 * scratch for each run, so tests are order-independent and leave no residue.
 *
 * Migrations are applied with the same engine the application uses
 * (better-sqlite3), which keeps the test schema byte-identical to a production
 * install.
 *
 * The path is a fixed name on purpose. Vitest re-evaluates this module in the
 * `globalSetup` process as well as in the workers, so a PID- or timestamp-based
 * name would resolve differently per process and the setup would migrate one
 * file while the tests opened another. Two concurrent suites therefore share
 * this file, which `acquireTestDatabaseLock()` detects and refuses.
 */

export const TEST_DB_PATH = path.join(process.cwd(), '.tmp', 'vitest', 'test.db');

const LOCK_PATH = `${TEST_DB_PATH}.lock`;

/**
 * Refuses to start when another suite already owns the shared test database.
 *
 * Without it, two `npm test` runs at once silently delete and recreate the file
 * under each other, which shows up as whole test files failing for reasons that
 * have nothing to do with the code under test.
 */
export function acquireTestDatabaseLock(): () => void {
  fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
  try {
    // 'wx' fails if the file already exists: the lock is never stolen.
    fs.writeFileSync(LOCK_PATH, String(process.pid), { flag: 'wx' });
  } catch {
    const owner = fs.existsSync(LOCK_PATH) ? fs.readFileSync(LOCK_PATH, 'utf8').trim() : '?';
    throw new Error(
      `Another test run (pid ${owner}) is already using ${TEST_DB_PATH}.\n` +
        'Wait for it to finish, or delete the lock file if you are sure nothing is running:\n' +
        `  rm ${LOCK_PATH}`,
    );
  }
  return () => fs.rmSync(LOCK_PATH, { force: true });
}

function migrationFiles(): string[] {
  const dir = path.join(process.cwd(), 'prisma', 'migrations');
  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
    .map((name) => path.join(dir, name, 'migration.sql'))
    .filter((file) => fs.existsSync(file))
    .sort();
}

/** Deletes the test database and rebuilds it from every migration. */
export function createTestDatabase(): string {
  fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(`${TEST_DB_PATH}${suffix}`, { force: true });
  }

  const db = new Database(TEST_DB_PATH);
  try {
    db.pragma('foreign_keys = ON');
    for (const file of migrationFiles()) {
      db.exec(fs.readFileSync(file, 'utf8'));
    }
  } finally {
    db.close();
  }
  return TEST_DB_PATH;
}

export function destroyTestDatabase(): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(`${TEST_DB_PATH}${suffix}`, { force: true });
  }
  fs.rmSync(LOCK_PATH, { force: true });
}

/**
 * Empties every business table without dropping the schema, so each test starts
 * from a clean database that still has the production constraints.
 *
 * The deletes go through the shared Prisma client rather than a second
 * better-sqlite3 connection: two connections on one file race for the write
 * lock, and the loser gets SQLITE_BUSY - which surfaced as whole test files
 * failing depending on machine load. One connection, one queue, no race.
 */
/**
 * The slice of the Prisma client this helper needs. Typed structurally so the
 * tests can pass the real client without dragging in the generated client type.
 */
type TruncatableClient = {
  $queryRawUnsafe<T = unknown>(sql: string): Promise<T>;
  $transaction<T>(fn: (tx: { $executeRawUnsafe(sql: string): Promise<number> }) => Promise<T>): Promise<T>;
};

export async function truncateAllTables(prisma: TruncatableClient): Promise<void> {
  const tables = (
    await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    )
  ).filter(({ name }) => name !== '_prisma_migrations');

  await prisma.$transaction(async (tx) => {
    // Foreign keys stay ON: with everything deleted there is nothing to
    // violate, and constraints keep being enforced between the DELETEs.
    for (const { name } of tables) {
      await tx.$executeRawUnsafe(`DELETE FROM "${name}"`);
    }
  });
}
