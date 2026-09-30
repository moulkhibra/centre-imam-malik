import path from 'node:path';
import { afterAll, beforeEach } from 'vitest';
import { cookieJar } from '../helpers/cookie-jar';
import { prisma } from '@/lib/db/client';

/**
 * Integration-suite setup.
 *
 * Guards the one invariant that matters here: the tests must never touch the
 * client's real database. If DATABASE_URL does not point inside the throwaway
 * `.tmp/vitest` directory, the suite aborts instead of running.
 */
const expected = path.resolve(process.cwd(), '.tmp', 'vitest');
const actual = path.resolve((process.env.DATABASE_URL ?? '').replace(/^file:/, ''));

if (!actual.startsWith(`${expected}${path.sep}`)) {
  throw new Error(
    `Refusing to run integration tests against ${process.env.DATABASE_URL}. Expected a database under ${expected}.`,
  );
}

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});
