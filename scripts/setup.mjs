#!/usr/bin/env node
/**
 * Cross-platform installer used by install.bat (and by `npm run setup`).
 *
 * Responsibilities:
 *   1. Verify Node.js 22 LTS.
 *   2. Create a .env with a cryptographically random SESSION_SECRET (never a
 *      default value) if one does not already exist.
 *   3. Run Prisma migrations.
 *   4. Install the reference data + the initial administrator account, with the
 *      administrator forced to change the password on first login.
 *
 * The script is idempotent: running it again never destroys existing data.
 */

import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');
const REQUIRED_MAJOR = '22';

const c = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
};

const ok = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => console.log(`${c.yellow}!${c.reset} ${m}`);
const fail = (m) => {
  console.error(`${c.red}✗${c.reset} ${m}`);
  process.exit(1);
};
const step = (m) => console.log(`\n${c.bold}${c.cyan}==> ${m}${c.reset}`);

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

// --- 1. Node version --------------------------------------------------------

function checkNodeVersion() {
  const major = process.versions.node.split('.')[0];
  if (major !== REQUIRED_MAJOR) {
    console.error('');
    console.error(`${c.red}${c.bold}  Node.js ${REQUIRED_MAJOR} LTS est requis.${c.reset}`);
    console.error('');
    console.error(`  Version détectée : Node.js ${process.versions.node}`);
    console.error('');
    console.error('  Installation :');
    console.error('    1. Ouvrez https://nodejs.org');
    console.error(`    2. Téléchargez la version ${REQUIRED_MAJOR}.x LTS (Windows Installer .msi)`);
    console.error('    3. Redémarrez l\'ordinateur');
    console.error('    4. Relancez install.bat');
    console.error('');
    process.exit(1);
  }
  ok(`Node.js ${process.versions.node}`);
}

// --- 2. .env -----------------------------------------------------------------

function generateSecret() {
  return randomBytes(48).toString('hex');
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return out;
}

/**
 * The uploads folder, resolved as `src/lib/storage/uploads.ts` resolves it, so
 * setup creates the directory the running application will actually write to.
 */
function uploadsRoot() {
  const configured = parseEnv(fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '').UPLOADS_DIR;
  return path.resolve(ROOT, configured && configured.trim() ? configured.trim() : 'uploads');
}

function writeEnv(values) {
  const header = [
    '# ---------------------------------------------------------------------------',
    '# Centre Imam Malik - configuration locale',
    '# Généré automatiquement par install.bat. Ne pas partager ce fichier.',
    '# ---------------------------------------------------------------------------',
    '',
  ];
  const body = Object.entries(values).map(([k, v]) => `${k}=${JSON.stringify(String(v))}`);
  fs.writeFileSync(ENV_PATH, `${header.join('\n')}\n${body.join('\n')}\n`, 'utf8');
}

function ensureEnv(answers) {
  step('Configuration');
  if (!fs.existsSync(ENV_PATH)) {
    const secret = generateSecret();
    const values = {
      DATABASE_URL: 'file:./prisma/data/centre.db',
      SESSION_SECRET: secret,
      APP_URL: answers.appUrl,
      HOSTNAME: answers.hostname,
      PORT: answers.port,
      DEFAULT_LOCALE: 'fr',
      SEED_CENTER_CODE: 'CIM',
      SEED_CENTER_NAME_FR: answers.nameFr,
      SEED_CENTER_NAME_AR: answers.nameAr,
      SEED_CENTER_ADDRESS: answers.address,
      SEED_CENTER_PHONE: answers.phone,
      SEED_CENTER_EMAIL: answers.email,
      SEED_ADMIN_EMAIL: answers.adminEmail,
      SEED_ADMIN_PASSWORD: answers.adminPassword,
      SEED_ADMIN_FIRST_NAME: answers.adminFirstName,
      SEED_ADMIN_LAST_NAME: answers.adminLastName,
    };
    writeEnv(values);
    ok('.env créé');
    ok('SESSION_SECRET généré aléatoirement (96 caractères)');
  } else {
    const env = parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
      env.SESSION_SECRET = generateSecret();
      writeEnv(env);
      ok('SESSION_SECRET régénéré');
    } else {
      ok('SESSION_SECRET existant conservé');
    }

    // Fill in blanks without overwriting operator choices.
    const env2 = parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
    let changed = false;
    const defaults = {
      DATABASE_URL: 'file:./prisma/data/centre.db',
      APP_URL: answers.appUrl,
      HOSTNAME: answers.hostname,
      PORT: answers.port,
      DEFAULT_LOCALE: 'fr',
      SEED_CENTER_CODE: 'CIM',
      SEED_CENTER_NAME_FR: answers.nameFr,
      SEED_CENTER_NAME_AR: answers.nameAr,
      SEED_CENTER_ADDRESS: answers.address,
      SEED_CENTER_PHONE: answers.phone,
      SEED_CENTER_EMAIL: answers.email,
      SEED_ADMIN_EMAIL: answers.adminEmail,
      SEED_ADMIN_PASSWORD: answers.adminPassword,
      SEED_ADMIN_FIRST_NAME: answers.adminFirstName,
      SEED_ADMIN_LAST_NAME: answers.adminLastName,
    };
    for (const [k, v] of Object.entries(defaults)) {
      if (!env2[k] && v) {
        env2[k] = v;
        changed = true;
      }
    }
    if (changed) {
      writeEnv(env2);
      ok('.env complété');
    } else {
      ok('.env déjà configuré');
    }
  }

  fs.mkdirSync(path.join(ROOT, 'prisma', 'data'), { recursive: true });
  // Uploaded files live outside public/: see UPLOADS_DIR in .env.example.
  fs.mkdirSync(uploadsRoot(), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'backups'), { recursive: true });
}

// --- 3. Prisma ---------------------------------------------------------------

function run(command, args, label) {
  try {
    execFileSync(command, args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, PRISMA_SKIP_POSTINSTALL_GENERATE: '1' },
    });
    ok(label);
    return true;
  } catch {
    fail(`${label} — commande échouée : ${command} ${args.join(' ')}`);
  }
}

// --- 4. Interactive prompts --------------------------------------------------

function ask(rl, question, fallback = '') {
  const suffix = fallback ? ` [${fallback}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      const value = answer.trim();
      resolve(value || fallback);
    });
  });
}

function askHidden(rl, question) {
  return new Promise((resolve) => {
    process.stdout.write(`${question}: `);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (char) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(wasRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (char === '\u0003') {
        process.stdout.write('\n');
        process.exit(130);
      }
      if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    stdin.on('data', onData);
  });
}

function passwordProblem(pw) {
  if (pw.length < 8) return 'au moins 8 caractères';
  if (!/[A-Za-z]/.test(pw)) return 'au moins une lettre';
  if (!/\d/.test(pw)) return 'au moins un chiffre';
  return null;
}

async function collectAnswers(assumeYes) {
  const defaults = {
    nameFr: 'Centre Imam Malik de Soutien, Formation et Langues',
    nameAr: 'مركز الإمام مالك للدعم والتكوين واللغات',
    address: 'فوق مكتبة الإمام مالك، بجانب مقهى زاكورة',
    phone: '06 37 06 52 18',
    email: '',
    adminEmail: 'admin@centre.local',
    adminFirstName: 'Administrateur',
    adminLastName: 'Système',
    adminPassword: '',
    appUrl: 'http://localhost:3000',
    hostname: '127.0.0.1',
    port: '3000',
  };

  if (assumeYes) return defaults;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('');
  console.log(`${c.bold}  Configuration du centre${c.reset}`);
  console.log('  Appuyez sur Entrée pour accepter la valeur proposée.');
  console.log('');

  const a = {};
  a.nameFr = await ask(rl, '  Nom du centre (français)', defaults.nameFr);
  a.nameAr = await ask(rl, '  Nom du centre (arabe)', defaults.nameAr);
  a.address = await ask(rl, '  Adresse', defaults.address);
  a.phone = await ask(rl, '  Téléphone', defaults.phone);
  a.email = await ask(rl, '  E-mail du centre', defaults.email);

  console.log('');
  console.log(`${c.bold}  Compte administrateur${c.reset}`);
  a.adminEmail = await ask(rl, '  E-mail administrateur', defaults.adminEmail);
  a.adminFirstName = await ask(rl, '  Prénom', defaults.adminFirstName);
  a.adminLastName = await ask(rl, '  Nom', defaults.adminLastName);

  for (;;) {
    const first = await askHidden(rl, '  Mot de passe temporaire');
    const problem = passwordProblem(first);
    if (!problem) {
      const again = await askHidden(rl, '  Confirmer le mot de passe');
      if (first !== again) {
        warn('Les mots de passe ne correspondent pas.');
        continue;
      }
      a.adminPassword = first;
      break;
    }
    warn(`Mot de passe trop faible : ${problem}.`);
  }
  warn('L\'administrateur devra changer ce mot de passe à la première connexion.');

  console.log('');
  console.log(`${c.bold}  Accès réseau${c.reset}`);
  a.appUrl = await ask(rl, '  URL de l\'application', defaults.appUrl);
  a.hostname = await ask(rl, '  Adresse d\'écoute (0.0.0.0 = réseau local)', defaults.hostname);
  a.port = await ask(rl, '  Port', defaults.port);

  rl.close();
  return a;
}

// --- main --------------------------------------------------------------------

async function main() {
  console.log('');
  console.log(`${c.bold}  Installation - Centre Imam Malik${c.reset}`);
  console.log(`  ${c.cyan}Soutien, Formation et Langues${c.reset}`);
  console.log('');

  step('Vérification de l\'environnement');
  checkNodeVersion();

  const assumeYes = process.argv.includes('--yes');
  const answers = await collectAnswers(assumeYes);

  ensureEnv(answers);

  step('Base de données');
  run(npxCmd, ['prisma', 'generate'], 'Prisma Client généré');
  run(npxCmd, ['prisma', 'migrate', 'deploy'], 'Migrations appliquées');

  step('Données de référence et compte administrateur');
  run(npxCmd, ['prisma', 'db', 'seed'], 'Données de référence installées');

  step('Vérification');
  run(npxCmd, ['next', 'build'], 'Build de production');

  console.log('');
  console.log(`${c.green}${c.bold}  Installation terminée.${c.reset}`);
  console.log('');
  console.log('  Démarrage        : start.bat   (ou : npm start)');
  console.log('  Arrêt            : stop.bat');
  console.log('  Sauvegarde       : backup.bat  (ou : npm run backup)');
  console.log('  Connexion        :');
  if (answers.adminEmail) console.log(`    e-mail : ${answers.adminEmail}`);
  if (answers.adminPassword) console.log(`    mot de passe : ${answers.adminPassword}`);
  console.log('    (le mot de passe devra être changé à la première connexion)');
  console.log('');
  console.log(`  URL : ${answers.appUrl}`);
  console.log('');
}

main().catch((error) => {
  console.error('');
  fail(`Installation interrompue : ${error instanceof Error ? error.message : String(error)}`);
});
