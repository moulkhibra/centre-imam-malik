import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  E2E_ADMIN,
  E2E_DB_PATH,
  E2E_LOCKOUT,
  E2E_PHASE2_ADMIN,
  E2E_PHASE2B_DIRECTEUR,
  E2E_STAFF,
} from '../playwright.config';

/**
 * Prepares and tears down the end-to-end environment.
 *
 * Uses the production commands (`prisma migrate deploy`, `prisma/seed.ts`) so
 * the suite exercises the same path as the Windows installer. The database
 * lives under `.tmp/` and is deleted before and after the run, so a failed run
 * can never leave data behind or contaminate the next one.
 *
 * This runs as a *pre* script, not as Playwright's `globalSetup`: Playwright
 * boots `webServer` before `globalSetup`, so the server would already be running
 * against an empty database.
 */

function run(command: string, args: string[], env: Record<string, string>): void {
  execFileSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

export async function prepareE2eDatabase(): Promise<void> {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(`${E2E_DB_PATH}${suffix}`, { force: true });
  }
  fs.mkdirSync(E2E_DB_PATH.replace(/e2e\.db$/, ''), { recursive: true });
  // Uploads too: `UPLOADS_DIR` points the server at `.e2e-uploads`, so a run
  // starts from an empty folder and leaves nothing behind in `uploads/`.
  fs.rmSync(path.join(process.cwd(), '.e2e-uploads'), { recursive: true, force: true });
  fs.mkdirSync(path.join(process.cwd(), '.e2e-uploads', 'center'), { recursive: true });

  const env = { DATABASE_URL: `file:${E2E_DB_PATH}` };

  console.log('\n[e2e] applying migrations');
  run('npx', ['prisma', 'migrate', 'deploy'], env);

  console.log('[e2e] installing reference data and the administrator');
  run('npx', ['tsx', 'prisma/seed.ts'], {
    ...env,
    SEED_IS_PRODUCTION_SETUP: 'true',
    SEED_ADMIN_EMAIL: E2E_ADMIN.email,
    SEED_ADMIN_PASSWORD: E2E_ADMIN.password,
    SEED_ADMIN_FIRST_NAME: 'Amine',
    SEED_ADMIN_LAST_NAME: 'Administrateur',
  });

  // Always rebuild.
  //
  // This used to be skipped when `.next/BUILD_ID` already existed, which meant
  // the suite silently ran against a stale build: an RTL fix in the source was
  // invisible to the tests, and the failing test looked like the fix had failed
  // rather than like the harness had not compiled it. A release gate that can
  // test old code is not a gate.
  console.log('[e2e] building production bundle');
  run('npx', ['next', 'build'], { ...env, NODE_ENV: 'production' });

  await seedE2eUsers();
}

/**
 * Adds the accounts the suite needs beyond the administrator.
 *
 * The first name is a real one, not a marker like `E2E`: `LATIN_NAME` in
 * `src/lib/validation/people.ts` admits only letters, spaces and punctuation, so
 * an account called "E2E" cannot be edited at all - every save of it is refused
 * with "Prénom invalide", and a test that edits the seeded administrator would
 * be testing the fixture instead of the screen.
 *
 * Each test that mutates state (first-login password change, lockout) gets its
 * own account, so no test can break another one by running first.
 */
async function seedE2eUsers(): Promise<void> {
  process.env.DATABASE_URL = `file:${E2E_DB_PATH}`;
  const { prisma } = await import('@/lib/db/client');
  const { hashPassword } = await import('@/lib/auth/password');

  const center = await prisma.center.findFirstOrThrow();
  const accounts = [E2E_STAFF, E2E_LOCKOUT, E2E_PHASE2_ADMIN, E2E_PHASE2B_DIRECTEUR];

  for (const account of accounts) {
    await prisma.user.create({
      data: {
        centerId: center.id,
        email: account.email,
        passwordHash: await hashPassword(account.password),
        firstName: 'Amine',
        lastName: 'Utilisateur',
        role: account.role,
        locale: 'fr',
        isActive: true,
        mustChangePassword: false,
      },
    });
  }

  await prisma.$disconnect();
  console.log(`[e2e] accounts ready: ${accounts.map((a) => a.email).join(', ')}`);
}

// Only prepare when executed directly (`tsx e2e/prepare.ts`); importing this
// module from Playwright's globalTeardown must not touch the database.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await prepareE2eDatabase();
  // The Prisma client keeps handles open; the prepare step is done.
  process.exit(0);
}
