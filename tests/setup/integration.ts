import { afterAll, beforeEach } from 'vitest';
import { cookieJar } from '../helpers/cookie-jar';
import { prisma } from '@/lib/db/client';

/**
 * Integration-suite setup.
 *
 * Guards the one invariant that matters here: the tests must never touch the
 * client's real database. If DATABASE_URL does not point inside .tmp/, the
 * suite aborts instead of running.
 */
const TEST_DB_MARKER = `${'file:'}${process.cwd()}/.tmp/vitest/test.db`;

if (process.env.DATABASE_URL !== TEST_DB_MARKER) {
  throw new Error(
    `Refusing to run integration tests against ${process.env.DATABASE_URL}. Expected ${TEST_DB_MARKER}.`,
  );
}

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});
