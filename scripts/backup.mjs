#!/usr/bin/env node
/**
 * Backup and restore of the SQLite database, safe to run while the application
 * is serving traffic.
 *
 * Uses SQLite's own online backup (the `backup()` API), which takes a
 * consistent snapshot without locking the centre out during the copy. Copying
 * the .db file by hand while the server is running can capture a torn write.
 *
 * The archive holds the live database plus the uploads folder (receipts,
 * scanned documents) and the schema migration files, and is pruned to the last
 * N backups.
 *
 *   npm run backup              create a backup
 *   npm run backup -- --list    list existing backups
 *   npm run backup -- --restore backups/cim-2026-09-30T....tar.gz
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP_DIR = path.join(ROOT, 'backups');
const KEEP = Number(process.env.BACKUP_KEEP || 30);

const c = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
};
const ok = (m) => console.log(`${c.green}\u2713${c.reset} ${m}`);
const warn = (m) => console.log(`${c.yellow}!${c.reset} ${m}`);
const fail = (m) => {
  console.error(`${c.red}\u2717${c.reset} ${m}`);
  process.exit(1);
};
const step = (m) => console.log(`\n${c.bold}${c.cyan}==> ${m}${c.reset}`);

function readEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return out;
}

/**
 * The uploads folder, resolved exactly as `src/lib/storage/uploads.ts` does it.
 * A logo that is not in the archive is a logo a restore silently loses, so the
 * two resolutions have to stay in step.
 */
function uploadsRoot() {
  const configured = readEnv().UPLOADS_DIR;
  return path.resolve(ROOT, configured && configured.trim() ? configured.trim() : 'uploads');
}

function databaseFile() {
  const url = readEnv().DATABASE_URL || 'file:./prisma/data/centre.db';
  const raw = url.replace(/^file:/, '');
  return path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.tar.gz'))
    .sort()
    .reverse();
}

function formatSize(bytes) {
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function create() {
  const dbFile = databaseFile();
  if (!fs.existsSync(dbFile)) fail(`Base de donnees introuvable : ${dbFile}`);

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // The staging tree mirrors the application layout, so extracting the archive
  // over the project root restores each file exactly where it belongs.
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'cim-backup-'));
  const stagedDb = path.join(stage, path.relative(ROOT, dbFile));
  fs.mkdirSync(path.dirname(stagedDb), { recursive: true });

  step('Copie coherente de la base');
  const Database = require('better-sqlite3');
  const db = new Database(dbFile, { readonly: false });
  await db.backup(stagedDb);
  db.close();
  ok(`base : ${path.relative(ROOT, dbFile)} (${formatSize(fs.statSync(stagedDb).size)})`);

  const included = [path.relative(ROOT, dbFile)];
  for (const dir of [uploadsRoot(), 'prisma/migrations']) {
    const full = dir;
    if (fs.existsSync(full) && fs.readdirSync(full).length > 0) {
      const target = path.join(stage, path.relative(ROOT, full));
      fs.cpSync(full, target, { recursive: true });
      included.push(path.relative(ROOT, full));
      ok(`dossier : ${path.relative(ROOT, full)}`);
    }
  }

  step('Archivage');
  const archive = path.join(BACKUP_DIR, `cim-${stamp()}.tar.gz`);
  execFileSync('tar', ['-czf', archive, ...included], { cwd: stage, stdio: 'inherit' });
  ok(`archive : ${path.relative(ROOT, archive)} (${formatSize(fs.statSync(archive).size)})`);
  fs.rmSync(stage, { recursive: true, force: true });

  const all = listBackups();
  if (all.length > KEEP) {
    step(`Conservation des ${KEEP} sauvegardes les plus recentes`);
    for (const old of all.slice(KEEP)) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
      warn(`supprime : ${old}`);
    }
  }

  console.log('');
  console.log(`${c.green}${c.bold}  Sauvegarde terminee.${c.reset}`);
  console.log(`  ${c.bold}Restaurer${c.reset} : npm run backup -- --restore ${path.relative(ROOT, archive)}`);
  console.log('');
}

function resolveArchive(name) {
  // Accept a bare filename, a path relative to the project, or an absolute
  // path: the printed instructions use the project-relative form.
  const candidates = [
    path.isAbsolute(name) ? name : null,
    path.join(ROOT, name),
    path.join(BACKUP_DIR, name),
  ].filter(Boolean);
  return candidates.find((f) => fs.existsSync(f)) ?? candidates[1];
}

function restore(archiveName) {
  const archive = resolveArchive(archiveName);
  if (!fs.existsSync(archive)) fail(`Archive introuvable : ${archive}`);

  const dbFile = databaseFile();
  const stampNow = stamp();

  step('Arret de l\'application');
  warn('Arretez le serveur (stop.bat) avant de restaurer : le fichier sera remplace.');
  ok(`Sauvegarde de securite : ${path.basename(dbFile)} -> ${path.basename(dbFile)}.${stampNow}.bak`);
  if (fs.existsSync(dbFile)) fs.copyFileSync(dbFile, `${dbFile}.${stampNow}.bak`);

  step('Restauration');
  execFileSync('tar', ['-xzf', archive, '-C', ROOT], { cwd: ROOT, stdio: 'inherit' });
  ok('archive extraite');

  console.log('');
  console.log(`${c.green}${c.bold}  Restauration terminee.${c.reset}`);
  console.log('  Redemarrez l\'application, puis connectez-vous pour verifier.');
  console.log('');
}

function list() {
  const all = listBackups();
  step(`Sauvegardes (${all.length})`);
  if (all.length === 0) {
    console.log('  aucune. Lancez : npm run backup\n');
    return;
  }
  for (const name of all) {
    const file = path.join(BACKUP_DIR, name);
    const when = new Date(fs.statSync(file).mtime).toLocaleString('fr-FR');
    console.log(`  ${when}  ${formatSize(fs.statSync(file).size).padStart(9)}  ${name}`);
  }
  console.log('');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
Sauvegarde de la base de donnees du Centre Imam Malik.

  npm run backup                       creer une sauvegarde
  npm run backup -- --list              lister les sauvegardes
  npm run backup -- --restore <fichier> restaurer une sauvegarde

Les ${KEEP} sauvegardes les plus recentes sont conservees.
`);
    return;
  }
  if (argv.includes('--list')) return list();

  const restoreIndex = argv.indexOf('--restore');
  if (restoreIndex !== -1) {
    const name = argv[restoreIndex + 1];
    if (!name) fail('--restore attend le nom d\'une archive');
    return restore(name);
  }
  return create();
}

main().catch((error) => {
  console.error('');
  fail(`Sauvegarde interrompue : ${error instanceof Error ? error.message : String(error)}`);
});
