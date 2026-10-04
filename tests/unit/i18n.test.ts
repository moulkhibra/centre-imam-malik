import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectPaths, createTranslator, dir, isRtl, textDirection } from '@/lib/i18n';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { fr } from '@/lib/i18n/dictionaries/fr';
import {
  ACADEMIC_STAGES,
  ACADEMIC_STAGE_LABELS,
  GENDERS,
  ROLE_LABELS,
  ROOM_STATUSES,
  ROLES,
  STUDENT_STATUSES,
  STUDENT_STATUS_LABELS,
} from '@/lib/constants';

describe('locale direction', () => {
  it('switches to RTL for Arabic and back for French', () => {
    expect(dir('fr')).toBe('ltr');
    expect(dir('ar')).toBe('rtl');
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('fr')).toBe(false);
    expect(textDirection('ar')).toBe('right');
    expect(textDirection('fr')).toBe('left');
  });
});

describe('translation dictionaries', () => {
  const t = createTranslator('fr');
  const tAr = createTranslator('ar');

  it('translates the keys the application shell uses', () => {
    expect(t('common.save')).toBe('Enregistrer');
    expect(tAr('common.save')).toBe('حفظ');
    expect(t('common.appName')).toBe('Centre Imam Malik');
    expect(tAr('common.appName')).toBe('مركز الإمام مالك');
  });

  it('renders the same Arabic text with no placeholders', () => {
    expect(tAr('common.appName')).not.toMatch(/[{}]/);
    expect(collectPaths(ar).size).toBeGreaterThan(200);
  });

  it('has no Arabic key that French does not define', () => {
    const frPaths = collectPaths(fr);
    const extra = [...collectPaths(ar)].filter((key) => !frPaths.has(key));
    expect(extra).toEqual([]);
  });

  it('has no empty translation', () => {
    for (const locale of [fr, ar]) {
      for (const key of collectPaths(locale)) {
        const value = createTranslator(locale === fr ? 'fr' : 'ar')(key);
        expect(value.trim(), `empty value for ${key}`).not.toBe('');
      }
    }
  });

  it('interpolates variables', () => {
    expect(t('dashboard.welcome', { name: 'Amine' })).toContain('Amine');
    expect(tAr('dashboard.welcome', { name: 'أمين' })).toContain('أمين');
  });

  it('falls back to French instead of rendering a blank string', () => {
    expect(t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('contains real Arabic characters, not transliterated placeholders', () => {
    const arabic = [...tAr('nav.students'), ...tAr('finance.payments'), ...tAr('common.save')].join('');
    expect(arabic).toMatch(/[\u0600-\u06FF]/);
  });

  it('does not contain the incorrect Arabic forms of "teacher" and "parent"', () => {
    // `الأستاذة` is the definite form of the feminine noun: it can only be read
    // as a female teacher, so the sidebar announced a female teacher to a male
    // one. `الآباء` is the plural of "father", which excludes the mother.
    // Both are checked on the dictionary source, not on resolved keys, so a
    // reintroduced wording fails even under a key the tests never read.
    const arContent = fs.readFileSync(path.join(process.cwd(), 'src/lib/i18n/dictionaries/ar.ts'), 'utf8');
    expect(arContent).not.toContain('الأستاذة');
    expect(arContent).not.toContain('الآباء');
  });

  it('names the roles with the gender-neutral Arabic words', () => {
    // The same problem one level up: `مدير` is fine for a man and wrong for a
    // woman, while `أستاذ` covers both. The dictionary ships the labels, but the
    // role badges come from ROLE_LABELS in constants.ts, so both are asserted.
    expect(tAr('nav.teachers')).toBe('الأساتذة');
    expect(tAr('nav.parents')).toBe('الأولياء');
    expect(ROLE_LABELS.TEACHER.ar).toBe('أستاذ');
    expect(ROLE_LABELS.SECRETARY.ar).toBe('الأمين');
    for (const role of ROLES) {
      expect(ROLE_LABELS[role].ar, `${role} has no Arabic label`).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it('gives the shared busy indicator no hardcoded French label', () => {
    // The spinner is used on every screen, French and Arabic alike. A default
    // `aria-label="Chargement"` in the component is a French sentence nobody
    // can translate, and it is invisible: no dictionary check ever sees it.
    const source = fs.readFileSync(path.join(process.cwd(), 'src/components/ui/index.tsx'), 'utf8');
    const spinner = source.slice(source.indexOf('export function Spinner'));
    expect(spinner).not.toMatch(/ariaLabel\s*=\s*'/);
  });

  it('defines a label for every value of every closed set', () => {
    // These four are resolved by dynamic path (`common.statusValues.${value}`),
    // so no compiler and no dictionary parity check can see a missing member.
    for (const value of STUDENT_STATUSES) expect(t(`common.statusValues.${value}`)).not.toBe(`common.statusValues.${value}`);
    for (const value of GENDERS) expect(t(`common.genderValues.${value}`)).not.toBe(`common.genderValues.${value}`);
    for (const value of ACADEMIC_STAGES) expect(t(`common.stageValues.${value}`)).not.toBe(`common.stageValues.${value}`);
    for (const value of ROOM_STATUSES) expect(t(`common.roomStatusValues.${value}`)).not.toBe(`common.roomStatusValues.${value}`);
  });

  it('agrees with the label maps in constants.ts, which the PDF layer also uses', () => {
    // Two label sources exist for the same words; this is what keeps them from
    // drifting apart silently.
    for (const value of ACADEMIC_STAGES) {
      expect(t(`common.stageValues.${value}`)).toBe(ACADEMIC_STAGE_LABELS[value].fr);
      expect(tAr(`common.stageValues.${value}`)).toBe(ACADEMIC_STAGE_LABELS[value].ar);
    }
    for (const value of STUDENT_STATUSES) {
      expect(t(`common.statusValues.${value}`)).toBe(STUDENT_STATUS_LABELS[value].fr);
      expect(tAr(`common.statusValues.${value}`)).toBe(STUDENT_STATUS_LABELS[value].ar);
    }
  });

  it('keeps the same placeholder names in both languages', () => {
    // A template whose placeholders differ per locale would silently drop a
    // count in Arabic, because the view interpolates the names it knows.
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of [...collectPaths(fr)].filter((k) => /\{/.test(resolve(fr, k) ?? ''))) {
      expect(placeholders(resolve(ar, key) ?? ''), `placeholders differ for ${key}`).toEqual(placeholders(resolve(fr, key) ?? ''));
    }
  });
});

/**
 * The Phase 2B namespaces.
 *
 * Both screens are read in both languages, and the account screen is read by an
 * administrator who may well have chosen Arabic. A missing key is already caught
 * by the parity and the static-source checks above; what those cannot see is a
 * key that exists on both sides with the *French* sentence copied into the
 * Arabic one, which is exactly the defect the Arabic wording tests above were
 * written for.
 */
describe('users and settings namespaces', () => {
  const t = createTranslator('fr');
  const tAr = createTranslator('ar');
  const NAMESPACES = ['users', 'settings'] as const;

  function keysIn(locale: unknown, namespace: string): string[] {
    return [...collectPaths(locale)].filter((key) => key.startsWith(`${namespace}.`));
  }

  it('defines every key of both namespaces in the two languages', () => {
    for (const namespace of NAMESPACES) {
      const frKeys = keysIn(fr, namespace);
      expect(frKeys.length, `${namespace}.* is empty`).toBeGreaterThan(10);
      for (const key of frKeys) {
        const arabic = tAr(key);
        expect(arabic, `missing ${key} in ar`).not.toBe(key);
        expect(arabic.trim(), `empty ${key} in ar`).not.toBe('');
      }
    }
  });

  it('writes the Arabic side of both namespaces in Arabic', () => {
    // The dictionary is the only place an Arabic sentence can leak in from a
    // copy-paste, and it would pass every structural check above.
    const latins: string[] = [];
    for (const namespace of NAMESPACES) {
      for (const key of keysIn(ar, namespace)) {
        const value = tAr(key);
        // A few values are deliberately language-neutral: a role name is shown as
        // a badge, a code, a hex colour. Everything else must contain an Arabic
        // character, otherwise the Arabic screen shows a French sentence.
        if (/^[A-Z0-9#._/-]+$/.test(value.trim())) continue;
        if (!/[\u0600-\u06FF]/.test(value)) latins.push(`${key} = ${value}`);
      }
    }
    expect(latins).toEqual([]);
  });

  it('names the settings sections and the account actions the interface shows', () => {
    expect(t('users.title')).toBe('Utilisateurs');
    expect(tAr('users.title')).toMatch(/[\u0600-\u06FF]/);
    for (const key of ['users.new', 'users.resetPassword', 'users.deactivate', 'users.activate', 'users.permissions']) {
      expect(t(key), key).not.toBe(key);
      expect(tAr(key), key).not.toBe(key);
    }
    for (const key of ['settings.identity', 'settings.contact', 'settings.appearance', 'settings.documents', 'settings.readOnly']) {
      expect(t(key), key).not.toBe(key);
      expect(tAr(key), key).not.toBe(key);
    }
  });

  it('translates the banner the account guards raise', () => {
    // These are `errors.*` keys pushed by the Server Actions, so an Arabic
    // administrator refusing to lock themselves out would read a French sentence.
    for (const key of ['errors.lastAdmin', 'errors.selfAccessChange', 'errors.userNotFound', 'errors.teacherNotFound', 'errors.teacherAlreadyLinked', 'errors.centerNotFound']) {
      expect(t(key), key).not.toBe(key);
      expect(tAr(key), key).toMatch(/[\u0600-\u06FF]/);
    }
  });
});

/** Reads a dotted path out of a dictionary; used by the placeholder comparison. */
function resolve(dict: unknown, dotted: string): string | undefined {
  let current: unknown = dict;
  for (const segment of dotted.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

describe('translation keys used by the application', () => {
  const SRC = path.join(process.cwd(), 'src');

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(full) ? [full] : [];
    });
  }

  /**
   * Every statically written `t('...')` call in the tree.
   *
   * This is the guard the interrupted session was missing: a screen added with
   * its labels forgotten renders raw keys such as `students.title`, and nothing
   * else in the build fails - `t()` returns the path, and the Arabic parity
   * check passes because the key is absent from *both* dictionaries.
   */
  it('resolves to a real translation in both languages', () => {
    const frPaths = collectPaths(fr);
    const arPaths = collectPaths(ar);
    const missing: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
        const key = match[1];
        if (key === undefined) continue;
        if (!frPaths.has(key)) missing.push(`${key} (absent from fr) in ${path.relative(SRC, file)}`);
        else if (!arPaths.has(key)) missing.push(`${key} (absent from ar) in ${path.relative(SRC, file)}`);
      }
    }

    expect(missing).toEqual([]);
  });
});
