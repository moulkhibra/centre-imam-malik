import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

/**
 * `npm run admin:reset` - recovers an administrator account from the shell.
 *
 * This is the recovery path for the one situation the application itself refuses
 * to fix: an installation where the only administrator has lost the password.
 * Everything the interface does is deliberately unavailable here, so this command
 * is the last resort and says so.
 *
 * What it does, in the same order as `resetUserPasswordAction`:
 *  - hashes a temporary password and forces the change at the next login;
 *  - clears the lockout counters, which is the point of a reset;
 *  - **revokes every open session**, because a reset that leaves a working cookie
 *    behind protects nobody - whoever prompted the reset keeps their access;
 *  - writes a `PASSWORD_RESET` audit entry, never containing the password.
 *
 * What it refuses:
 *  - a database outside this project's `prisma/` directory, so a mistyped
 *    `DATABASE_URL` cannot rewrite an unrelated file;
 *  - an account that is not an ADMIN: a lost secretary password is a support
 *    question for an administrator who is still signed in, not a shell command;
 *  - a password that does not satisfy the same policy as the interface.
 *
 * The password is never echoed, never passed as an argument, and asked twice.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => resolve(answer));
  });
}

/**
 * Asks for a secret without echoing it.
 *
 * `readline` has no hidden-input mode, so on a terminal the keystrokes are
 * consumed raw and nothing is written back. Where stdin is a pipe (a scripted
 * recovery in a provisioning tool) there is no terminal to hide from and the
 * plain prompt is used, because raw mode is unavailable and the input was never
 * on screen anyway.
 */
function questionHidden(query: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY) {
    const rl = readline.createInterface({ input, output: process.stdout });
    return question(rl, query).finally(() => rl.close());
  }

  return new Promise((resolve) => {
    process.stdout.write(query);
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');

    let value = '';
    const finish = (result: string) => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      resolve(result);
    };
    function onData(char: string): void {
      // Ctrl+C cancels rather than storing a half-typed password.
      if (char === '\u0003') {
        input.setRawMode(false);
        process.stdout.write('\n');
        process.exit(130);
      }
      if (char === '\n' || char === '\r' || char === '\u0004') return finish(value);
      if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
        return;
      }
      if (char >= ' ') value += char;
    }

    input.on('data', onData);
  });
}

/** Minimal `.env` reader: the file the installer wrote, not a shell. */
function readEnvFile(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
    if (match?.[1] === undefined) continue;
    env[match[1]] = (match[2] ?? '').replace(/^"|"$/g, '');
  }
  return env;
}

async function main(): Promise<void> {
  const envPath = path.join(ROOT, '.env');
  const env = readEnvFile(envPath);
  if (!fs.existsSync(envPath)) {
    console.error('.env est introuvable. Lancez d\'abord `npm run setup`.');
    process.exit(1);
  }

  const raw = process.env.DATABASE_URL || env.DATABASE_URL || 'file:./prisma/data/centre.db';
  const withoutScheme = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  const dbPath = path.isAbsolute(withoutScheme) ? withoutScheme : path.join(ROOT, withoutScheme);
  const allowedRoot = path.join(ROOT, 'prisma');

  if (!dbPath.startsWith(`${allowedRoot}${path.sep}`) && dbPath !== allowedRoot) {
    console.error(`Refus d'écrire hors du dossier prisma/ du projet : ${dbPath}`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const email = (await question(rl, 'Adresse e-mail de l\'administrateur : ')).trim().toLowerCase();
  const password = await questionHidden('Nouveau mot de passe temporaire : ');
  // Asked twice: this command exists for the case where nobody can sign in any
  // more, so a mistyped password that is never retyped is unrecoverable without
  // editing the database by hand - which is what this script avoids.
  const confirmation = await questionHidden('Répétez le mot de passe : ');
  rl.close();

  if (password !== confirmation) {
    console.error('Les deux mots de passe ne correspondent pas. Rien n\'a été modifié.');
    process.exit(1);
  }

  const { checkPasswordPolicy, generateTemporaryPassword, hashPassword, writeAuditLog } = await import(
    '../src/lib/auth/password'
  );
  const { prisma } = await import('../src/lib/db/client');

  const policy = checkPasswordPolicy(password);
  if (!policy.ok) {
    console.error(`Mot de passe refusé par la politique : ${policy.message}`);
    console.error(`Exemple généré par l'application : ${generateTemporaryPassword()}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Aucun compte actif pour ${email}.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  if (user.role !== 'ADMIN') {
    console.error(
      `Ce compte est un ${user.role}, pas un administrateur. ` +
        "Un mot de passe oublié se réinitialise depuis l'écran Utilisateurs par un administrateur connecté.",
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const now = new Date();
  const [account, sessions] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  await writeAuditLog({
    centerId: user.centerId,
    userId: user.id,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: user.id,
    metadata: { reason: 'admin_reset_command', sessionsRevoked: sessions.count },
  });

  await prisma.$disconnect();
  console.log(
    `Mot de passe réinitialisé pour ${account.email} ` +
      'Le changement sera demandé à la prochaine connexion et toutes les sessions ouvertes ont été fermées.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});