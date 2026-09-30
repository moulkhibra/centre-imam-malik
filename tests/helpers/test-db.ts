import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Test database strategy.
 *
 * Integration tests run against a REAL SQLite database built from the real
 * migration files - never against a hand-written schema and never against the
 * production database. The file lives under `.tmp/` and is recreated from
 * scratch for each test file, so tests are order-independent and leave no
 * residue.
 *
 * Migrations are applied with the same engine the application uses
 * (better-sqlite3), which keeps the test schema byte-identical to a production
 * install.
 */

export const TEST_DB_PATH = path.join(process.cwd(), '.tmp', 'vitest', 'test.db');

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
}

/**
 * Empties every business table without dropping the schema, so each test starts
 * from a clean database that still has the production constraints.
 */
export function truncateAllTables(): void {
  const db = new Database(TEST_DB_PATH);
  try {
    db.pragma('foreign_keys = OFF');
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
      .all() as { name: string }[];
    for (const { name } of tables) {
      if (name === '_prisma_migrations') continue;
      db.prepare(`DELETE FROM "${name}"`).run();
    }
  } finally {
    db.pragma('foreign_keys = ON');
    db.close();
  }
}
