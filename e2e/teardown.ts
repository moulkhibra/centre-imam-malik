import fs from 'node:fs';
import { E2E_DB_PATH } from '../playwright.config';

/**
 * Removes the throwaway database once the suite has finished, whether it passed
 * or failed, so a run can never leave centre data behind.
 */
export default function globalTeardown(): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(`${E2E_DB_PATH}${suffix}`, { force: true });
  }
}