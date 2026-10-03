import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { fr } from '@/lib/i18n/dictionaries/fr';
import {
  ekey,
  errorMessages,
  isErrorMessage,
  resolveErrorMessage,
  resolveMessage,
  ERROR_PREFIX,
  type ErrorKey,
} from '@/lib/validation/messages';
import { validationMessages } from '@/lib/validation/messages';

/**
 * Banner messages travel as keys for the same reason validation messages do: a
 * Server Action runs outside any request-time locale, so the sentence it pushes
 * to the client was French on every screen. `handleError` returned literals
 * ('Données invalides', 'Cette valeur existe déjà') and the interface showed
 * them verbatim.
 *
 * These tests cover the three ways that can go wrong: a key missing from one
 * dictionary, a key the dictionary resolves to French, and - the one that
 * actually shipped - an error path that never got a key at all.
 */
const KEYS = Object.keys(fr.errors) as ErrorKey[];

describe('banner message keys', () => {
  it('covers every key of the French dictionary', () => {
    expect(KEYS.length).toBeGreaterThan(10);
    expect(errorMessages('fr')).toEqual(fr.errors);
    expect(errorMessages('ar')).toEqual(ar.errors);
  });

  it('has an Arabic message for every French one', () => {
    const missing = KEYS.filter((key) => !ar.errors[key]);
    expect(missing, 'an errors.* key has no Arabic text').toEqual([]);
    expect(Object.keys(ar.errors).sort()).toEqual([...KEYS].sort());
  });

  it('resolves every key to Arabic script, never to the French sentence', () => {
    const arabic = /[\u0600-\u06ff]/;
    for (const key of KEYS) {
      expect(ar.errors[key], `errors.${key} has no Arabic script`).toMatch(arabic);
      expect(ar.errors[key], `errors.${key} is still the French text`).not.toBe(fr.errors[key]);
    }
  });

  it('writes and recognises a key', () => {
    expect(ekey('duplicate')).toBe('errors.duplicate');
    expect(isErrorMessage('errors.duplicate')).toBe(true);
    expect(isErrorMessage('validation.fieldRequired')).toBe(false);
    expect(isErrorMessage('Données invalides')).toBe(false);
  });

  it('leaves a value that is not a key untouched', () => {
    // The catch branches in the forms pass an already localised `labels.error`,
    // and a test fixture may pass a plain sentence. Neither must vanish.
    for (const value of ['Erreur', 'Something else entirely', '']) {
      expect(resolveErrorMessage(value, errorMessages('ar'))).toBe(value);
    }
  });

  it('resolves both namespaces from one call, as a Field holds both', () => {
    const validation = validationMessages('ar');
    const errors = errorMessages('ar');
    // A rule key from the schema...
    expect(resolveMessage('validation.fieldRequired', validation, errors)).toBe(ar.validation.fieldRequired);
    // ...and an errors.* key from the action, on the same field.
    expect(resolveMessage('errors.valueAlreadyUsed', validation, errors)).toBe(ar.errors.valueAlreadyUsed);
  });
});

/**
 * The failure mode that was actually shipped was not a missing translation, it
 * was an error path that carried a French sentence and no key: `Alert` then fell
 * back to `children` and rendered French on an Arabic screen. So these tests
 * look at the source of every path that can put a banner on the screen.
 */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : [];
  });
}

const SRC = path.join(process.cwd(), 'src');

/** The keys the actions must use instead of a sentence. */
const EXPECTED_KEYS_IN_ERRORS = [
  'validation',
  'sessionExpired',
  'rateLimited',
  'forbidden',
  'notFound',
  'duplicate',
  'conflict',
  'serverError',
  'invalidReference',
  'valueAlreadyUsed',
];

describe('the error layer sends keys, not sentences', () => {
  it('maps every error code to a key', () => {
    const source = fs.readFileSync(path.join(SRC, 'lib/utils/errors.ts'), 'utf8');
    const codes = ['VALIDATION', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'DUPLICATE', 'CONFLICT', 'RATE_LIMITED', 'INTERNAL'];
    for (const code of codes) {
      expect(source, `${code} is missing from DOMAIN_KEY_BY_CODE`).toContain(`${code}: ekey(`);
    }
  });

  it('keeps the French sentences and the dictionary in step', () => {
    // `DOMAIN_MESSAGE_BY_CODE` exists for the server log and for the integration
    // suite. If it drifts from `fr.errors`, the French interface would change
    // without anyone editing a dictionary, and the Arabic one would not follow.
    const source = fs.readFileSync(path.join(SRC, 'lib/utils/errors.ts'), 'utf8');
    const pairs: Array<[ErrorKey, string]> = [
      ['validation', 'VALIDATION'],
      ['sessionExpired', 'UNAUTHENTICATED'],
      ['forbidden', 'FORBIDDEN'],
      ['notFound', 'NOT_FOUND'],
      ['duplicate', 'DUPLICATE'],
      ['conflict', 'CONFLICT'],
      ['rateLimited', 'RATE_LIMITED'],
      ['serverError', 'INTERNAL'],
    ];
    for (const [key, code] of pairs) {
      // `CODE: ekey('key')` and `CODE: '<the French sentence>'` both have to exist.
      expect(source, `${code} does not map to errors.${key}`).toContain(`${code}: ekey('${key}')`);
      expect(source, `${code} has no sentence, or a different one than fr.errors.${key}`).toContain(
        `${code}: '${fr.errors[key].replace(/'/g, "\\'")}'`,
      );
    }
  });

  it('puts a key on every hand-written error result in the actions', () => {
    // These are the results that bypass `fail()`, which is where a key can go
    // missing without the compiler noticing.
    const offenders = sourceFiles(path.join(SRC, 'actions'))
      .flatMap((file) => {
        const source = fs.readFileSync(file, 'utf8');
// Every `error: '<a sentence>'` must sit next to an `errorKey` in the
        // same object literal. The body allows escaped quotes, because the
        // shipped sentences contain apostrophes ("l'administrateur").
        return [...source.matchAll(/error: '((?:[^'\\]|\\.)*[a-zA-ZÀ-ɏ](?:[^'\\]|\\.)*)'/g)]
          .filter((match) => !source.slice(match.index + match[0].length).split('}')[0]?.includes('errorKey'))
          .map((match) => `${path.relative(process.cwd(), file)}: ${match[1]}`);
      });
    expect(offenders, 'an action returns a French sentence with no key').toEqual([]);
  });

  it('gives every Alert in a form or list a way to translate its banner', () => {
    // A banner that cannot be translated is one nobody remembered to key. The
    // three alerts that have no `errorKey` are the ones that take text from a
    // dictionary label rather than from an action.
    const offenders: string[] = [];
    for (const file of sourceFiles(path.join(SRC, 'components')).concat(sourceFiles(path.join(SRC, 'app')))) {
      const source = fs.readFileSync(file, 'utf8');
      const alerts = [...source.matchAll(/<Alert\b([^>]*)>/g)];
      for (const alert of alerts) {
        const attributes = alert[1] ?? '';
        if (/tone="danger"/.test(attributes) && !/errorKey=/.test(attributes)) {
          offenders.push(`${path.relative(process.cwd(), file)}: <Alert${attributes}>`);
        }
      }
    }
    expect(offenders, 'a danger banner has no errorKey').toEqual([]);
  });

  it('uses only keys that exist', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/ekey\('([^']+)'\)/g)) used.add(match[1] ?? '');
      for (const match of source.matchAll(/'errors\.([a-zA-Z]+)'/g)) used.add(match[1] ?? '');
    }
    expect([...used].filter((key) => !(key in fr.errors))).toEqual([]);
  });

  it('has a key for every code the actions can answer with', () => {
    for (const key of EXPECTED_KEYS_IN_ERRORS) {
      expect(key in fr.errors, `errors.${key} is missing`).toBe(true);
      expect(ar.errors[key as ErrorKey]).toBeTruthy();
    }
    expect(`${ERROR_PREFIX}validation`).toBe('errors.validation');
  });
});