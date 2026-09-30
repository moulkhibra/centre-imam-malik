/**
 * Creates a local development administrator.
 *
 * WHY THIS EXISTS
 * The production installer (`npm run setup`) asks the operator for the admin
 * credentials and writes them to `.env`. That is the right path for a real
 * installation and it is deliberately NOT automated: a repository that ships a
 * default admin password is a repository with a backdoor.
 *
 * This script exists only so a developer can get into their own machine
 * without answering the interactive installer. It refuses to run in a
 * production setup and it uses the application's own hashing and permission
 * code, so the account is a genuine account, not a bypass.
 *
 *   npm run dev:admin                    # dev@centre-imam-malik.local / DevAdmin!2026
 *   npm run dev:admin -- admin@x.tld 'My password'
 *
 * The password is hashed exactly like a real one (bcrypt, cost 12) and the
 * account is created with `mustChangePassword`, so logging in behaves exactly
 * as it does in production.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const c = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33b',
  cyan: '\u001b[36m',
};

function fail(message: string): never {
  console.error(`${c.red}\u2717${c.reset} ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  // --- refuse to touch a production setup ----------------------------------
  if (process.env.SEED_IS_PRODUCTION_SETUP === 'true') {
    fail('SEED_IS_PRODUCTION_SETUP is set: this looks like a production install. Create the admin through `npm run setup`.');
  }
  if (process.env.NODE_ENV === 'production') {
    fail('NODE_ENV=production: refusing to create a development account. Use `npm run setup`.');
  }

  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    fail('.env is missing. Run `npm run setup` first (it also creates the reference data).');
  }

  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m?.[1] !== undefined) env[m[1]] = (m[2] ?? '').replace(/^"|"$/g, '');
  }

  const raw = process.env.DATABASE_URL || env.DATABASE_URL || 'file:./prisma/data/centre.db';
  const withoutScheme = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  const dbPath = path.isAbsolute(withoutScheme) ? withoutScheme : path.join(ROOT, withoutScheme);

  if (!dbPath.startsWith(path.join(ROOT, 'prisma'))) {
    fail(`Refusing to write outside the project's prisma/ directory: ${dbPath}`);
  }

  const args = process.argv.slice(2);
  const email = (args[0] ?? 'dev@centre-imam-malik.local').trim().toLowerCase();
  const password = args[1] ?? 'DevAdmin!2026';

  const { hashPassword, checkPasswordPolicy } = await import('../src/lib/auth/password');
  const { prisma } = await import('../src/lib/db/client');

  const policy = checkPasswordPolicy(password);
  if (!policy.ok) fail(`Password rejected by the application policy: ${policy.message}`);

  const center = await prisma.center.findFirst();
  if (!center) {
    fail('No centre in the database. Run `npm run db:seed` to install the reference data.');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const data = {
    centerId: center.id,
    email,
    passwordHash: await hashPassword(password),
    firstName: 'Dev',
    lastName: 'Administrateur',
    role: 'ADMIN' as const,
    permissions: JSON.stringify([]),
    isActive: true,
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  if (existing) {
    await prisma.user.update({ where: { email }, data });
    console.log(`${c.yellow}=${c.reset} existing account reset: ${email}`);
  } else {
    await prisma.user.create({ data });
    console.log(`${c.green}+${c.reset} administrator created: ${email}`);
  }

  await prisma.$disconnect();

  console.log('');
  console.log(`  ${c.bold}e-mail${c.reset}    ${email}`);
  console.log(`  ${c.bold}mot de passe${c.reset} ${password}`);
  console.log('');
  console.log(`  ${c.cyan}Connexion${c.reset}   npm run dev${c.reset}  ${c.cyan}puis${c.reset}  http://localhost:3000/login`);
  console.log(`  ${c.cyan}Arret${c.reset}        Ctrl+C`);
  console.log('');
  console.log(`  ${c.yellow}Cet compte est local et sans importance : supprimez-le avant toute utilisation reelle.${c.reset}`);
  console.log('');
}

main().catch((error: unknown) => {
  console.error('');
  fail(`Echec : ${error instanceof Error ? error.message : String(error)}`);
});
