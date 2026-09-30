import { createTestDatabase, destroyTestDatabase } from '../helpers/test-db';

/**
 * Builds the throwaway SQLite database from the real migrations once per run
 * and removes it afterwards. Runs in the Vitest main process, so the file must
 * exist before any worker imports the Prisma client.
 */
export async function setup(): Promise<void> {
  createTestDatabase();
}

export async function teardown(): Promise<void> {
  destroyTestDatabase();
}
