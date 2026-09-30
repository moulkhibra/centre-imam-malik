import {
  acquireTestDatabaseLock,
  createTestDatabase,
  destroyTestDatabase,
} from '../helpers/test-db';

let releaseLock: (() => void) | undefined;

/**
 * Builds the throwaway SQLite database from the real migrations once per run
 * and removes it afterwards. Runs in the Vitest main process, so the file must
 * exist before any worker imports the Prisma client.
 */
export async function setup(): Promise<void> {
  releaseLock = acquireTestDatabaseLock();
  try {
    createTestDatabase();
  } catch (error) {
    // Never leave the lock behind, or no later run could start.
    releaseLock();
    releaseLock = undefined;
    throw error;
  }
}

export async function teardown(): Promise<void> {
  // Vitest calls teardown even when setup failed. A run that never took the
  // lock must not delete the database of the run that holds it.
  if (!releaseLock) return;
  destroyTestDatabase();
  releaseLock();
}
