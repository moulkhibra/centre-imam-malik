import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * The suite runs against a REAL production build (`next build` + `next start`)
 * with its own SQLite database created by the real migration and seed commands.
 * Nothing is mocked, so a passing run means the installer path and the login
 * flow actually work.
 */
export const E2E_DB_PATH = path.join(process.cwd(), '.tmp', 'e2e', 'e2e.db');
export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3210';

/**
 * Accounts used by the suite. Tests that change state own their account so that
 * running them in any order cannot break another test.
 */
export const E2E_ADMIN = {
  email: 'e2e.admin@example.test',
  password: 'E2e!Admin2026',
  newPassword: 'E2e!Admin2026x',
};

/** Read-only account used by the dashboard, navigation and locale tests. */
export const E2E_STAFF = {
  email: 'e2e.staff@example.test',
  password: 'E2e!Staff2026',
  role: 'SECRETARY',
};

/**
 * Administrator for the Phase 2 suite, with no forced password change.
 *
 * `E2E_ADMIN` must complete its first-login password change, which permanently
 * replaces its password and makes it unusable for any later test in the same
 * run. Phase 2 needs an ADMIN (only ADMIN holds `academics.manage`) across
 * fourteen tests, so it gets its own account rather than fighting over that one.
 */
export const E2E_PHASE2_ADMIN = {
  email: 'e2e.phase2@example.test',
  password: 'E2e!Phase2Admin2026',
  role: 'ADMIN',
};

/** Account deliberately locked out by the failed-login test, and never used elsewhere. */
/**
 * Read-only account for the Phase 2B suite.
 *
 * DIRECTEUR is the only seeded role holding `users.view` and `settings.view`
 * without `users.manage` or `settings.manage`, which makes it the one account
 * that can see both new screens and change nothing on either. SECRETARY cannot
 * reach them at all and ADMIN can write, so neither can express the difference
 * the `canManage` flag makes.
 */
export const E2E_PHASE2B_DIRECTEUR = {
  email: 'e2e.phase2b.directeur@example.test',
  password: 'E2e!Directeur2026',
  role: 'DIRECTEUR',
};

export const E2E_LOCKOUT = {
  email: 'e2e.lockout@example.test',
  password: 'E2e!Lockout2026',
  role: 'SECRETARY',
};

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/teardown.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: E2E_BASE_URL,
    locale: 'fr-MA',
    timezoneId: 'Africa/Casablanca',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `next start` honours the PORT env var, which the E2E run pins to 3210 so
    // it never collides with a development server on 3000.
    command: 'npx next start',
    url: E2E_BASE_URL,
    // Never reuse an existing server: this run owns its own database, so it
    // must own the server too. A leftover dev server would answer with a
    // different SQLite file and produce failures that do not reproduce.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: `file:${E2E_DB_PATH}`,
      SESSION_SECRET: 'e2e-only-session-secret-0000000000000000000000000',
      APP_URL: E2E_BASE_URL,
      HOSTNAME: '127.0.0.1',
      PORT: '3210',
      DEFAULT_LOCALE: 'fr',
      // Uploads land in their own folder: an E2E run must not leave a logo in
      // the developer's `uploads/`, and must not read one that is already there.
      UPLOADS_DIR: '.e2e-uploads',
    },
  },
});
