import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Client/server boundary guard.
 *
 * A Client Component that imports a module touching the database, the session
 * cookie or the file system either fails at runtime in the browser or, worse,
 * leaks secrets into the client bundle. ESLint flat config cannot tell a
 * Client Component from a Server Component, so this test does: it parses every
 * file that declares "use client" and walks its transitive local imports.
 */

const SRC = path.join(process.cwd(), 'src');

const SERVER_ONLY_PREFIXES = [
  '@/lib/db/client',
  '@/lib/auth/session',
  '@/lib/settings/center',
  '@/lib/pdf/fonts',
  '@/lib/settings/defaults',
  '@/lib/dashboard/queries',
];

const SERVER_ONLY_FILES = ['src/lib/utils/server-only.ts'];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function isClientComponent(file: string): boolean {
  return /^['"]use client['"]/.test(fs.readFileSync(file, 'utf8').trimStart());
}

function resolveLocalImport(fromFile: string, specifier: string): string | null {
  const base = path.join(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function importedSpecifiers(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  const specifiers: string[] = [];
  const patterns = [/import\s+[^'"]*from\s*['"]([^'"]+)['"]/g, /import\s*['"]([^'"]+)['"]/g, /export\s+[^'"]*from\s*['"]([^'"]+)['"]/g];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) specifiers.push(match[1]);
    }
  }
  return specifiers;
}

describe('client/server boundaries', () => {
  const clientFiles = walk(SRC).filter(isClientComponent);

  it('finds the client components to check', () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  it('never imports a server-only module from a Client Component', () => {
    const violations: string[] = [];

    const visit = (file: string, trail: string[]) => {
      for (const specifier of importedSpecifiers(file)) {
        if (SERVER_ONLY_PREFIXES.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`))) {
          violations.push(`${trail.join(' -> ')} imports ${specifier}`);
          continue;
        }
        const resolved = resolveLocalImport(file, specifier);
        if (resolved && !trail.includes(resolved)) visit(resolved, [...trail, resolved]);
      }
    };

    for (const file of clientFiles) visit(file, [path.relative(process.cwd(), file)]);
    expect(violations).toEqual([]);
  });

  it('never pulls a Node built-in into a Client Component', () => {
    const violations: string[] = [];
    for (const file of clientFiles) {
      for (const specifier of importedSpecifiers(file)) {
        if (specifier.startsWith('node:') || ['fs', 'path', 'crypto', 'child_process', 'better-sqlite3'].includes(specifier)) {
          violations.push(`${path.relative(process.cwd(), file)} imports ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('protects server modules with the runtime guard', () => {
    for (const relative of SERVER_ONLY_FILES) {
      expect(fs.existsSync(path.join(process.cwd(), relative))).toBe(true);
    }
    expect(fs.readFileSync(path.join(process.cwd(), SERVER_ONLY_FILES[0]!), 'utf8')).toMatch(
      /typeof window !== 'undefined'/,
    );
  });
});
