import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { fr } from '@/lib/i18n/dictionaries/fr';
import {
  resolveValidationMessage,
  isValidationMessage,
  VALIDATION_PREFIX,
  validationMessages,
  vmsg,
  type ValidationKey,
} from '@/lib/validation/messages';
import { moneySchema, passwordSchema, phoneSchema, isoDateSchema, hexColorSchema } from '@/lib/validation/common';
import {
  levelCreateSchema,
  parentCreateSchema,
  roomCreateSchema,
  serviceCreateSchema,
  studentCreateSchema,
  subjectCreateSchema,
  teacherCreateSchema,
} from '@/lib/validation/people';
import type { z } from 'zod';

const KEYS = Object.keys(fr.validation) as ValidationKey[];
const arabicMessages = validationMessages('ar');
const frenchMessages = validationMessages('fr');

/**
 * The Phase 2 defect this file exists to prevent.
 *
 * A Zod schema is parsed twice - once by the form, once by the Server Action -
 * and it has no idea which locale is asking. So it must not hold a sentence: it
 * holds a `validation.*` key, and the interface turns that key into text at the
 * last moment. Before this change the sentence was baked in, which is why an
 * Arabic student form answered "Prénom invalide" under an Arabic label.
 */
describe('validation messages travel as keys', () => {
  it('gives every rule a key instead of a sentence', () => {
    expect(KEYS.length).toBeGreaterThan(35);
    expect(vmsg('firstNameInvalid')).toBe('validation.firstNameInvalid');
    expect(isValidationMessage('validation.firstNameInvalid')).toBe(true);
    expect(isValidationMessage('Prénom invalide')).toBe(false);
  });

  it('renders the Arabic sentence, not the French one, for an Arabic interface', () => {
    expect(resolveValidationMessage(vmsg('firstNameInvalid'), arabicMessages)).toBe('الاسم الشخصي غير صالح');
    expect(resolveValidationMessage(vmsg('firstNameInvalid'), frenchMessages)).toBe('Prénom invalide');
    expect(resolveValidationMessage(vmsg('firstNameInvalid'), arabicMessages)).not.toBe(
      resolveValidationMessage(vmsg('firstNameInvalid'), frenchMessages),
    );
  });

  /**
   * A sentence that is not a key comes from a Server Action, not from a schema.
   * It is passed through untouched rather than being blanked or mangled.
   */
  it('leaves a message it does not own alone', () => {
    expect(resolveValidationMessage('Cette valeur existe déjà', arabicMessages)).toBe('Cette valeur existe déjà');
    expect(resolveValidationMessage('validation.unknownKey', arabicMessages)).toBe('validation.unknownKey');
    expect(resolveValidationMessage('', arabicMessages)).toBe('');
  });

  it('defines a non-empty Arabic translation for every key', () => {
    for (const key of KEYS) {
      expect(arabicMessages[key]?.trim(), `no Arabic text for ${key}`).not.toBe('');
      expect(frenchMessages[key]?.trim(), `no French text for ${key}`).not.toBe('');
    }
  });

  it('really translates: the Arabic text contains Arabic script', () => {
    // A copy of the French string would pass every check above and be useless.
    for (const key of KEYS) {
      expect(arabicMessages[key], `Arabic text for ${key} is not Arabic`).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it('never reuses the French sentence as the Arabic one', () => {
    const identical = KEYS.filter((key) => arabicMessages[key] === frenchMessages[key]);
    expect(identical).toEqual([]);
  });

  /**
   * The wording shipped in Phase 2 is the wording the French interface shows
   * today; translating the schemas must not quietly reword it.
   */
  it('keeps the French wording that shipped in Phase 2', () => {
    const shipped: Record<string, string> = {
      firstNameTooShort: 'Prénom trop court',
      firstNameTooLong: 'Prénom trop long',
      firstNameInvalid: 'Prénom invalide',
      lastNameTooShort: 'Nom trop court',
      lastNameTooLong: 'Nom trop long',
      lastNameInvalid: 'Nom invalide',
      codeRequired: 'Code obligatoire',
      codeTooLong: 'Code trop long (20 caractères maximum)',
      codeInvalid: 'Code invalide : lettres, chiffres, - et _ uniquement',
      birthDateFormat: 'Date de naissance attendue au format AAAA-MM-JJ',
      birthDateInvalid: 'Date de naissance invalide',
      phoneTooShort: 'Numéro de téléphone trop court',
      phoneTooLong: 'Numéro de téléphone trop long',
      phoneInvalid: 'Numéro de téléphone invalide',
      emailInvalid: 'E-mail invalide',
      cinInvalid: 'CIN invalide (ex: AB123456)',
      amountRequired: 'Montant obligatoire',
      amountNegative: 'Le montant ne peut pas être négatif',
      passwordMinLength: 'Au moins 8 caractères',
    };
    for (const [key, text] of Object.entries(shipped)) {
      expect(fr.validation[key as ValidationKey], `wording changed for ${key}`).toBe(text);
    }
  });
});

/** Every issue message a schema can produce for these inputs. */
function messagesFor(schema: z.ZodTypeAny, input: unknown): string[] {
  const parsed = schema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
}

/**
 * The guard that would have caught the original bug without a browser: every
 * issue a rule produces must be a key. Zod's own fallbacks ("Too small: expected
 * string to have >=2 characters", "Invalid option: expected one of ...") are
 * English, so a rule left without a message would still put a foreign sentence
 * on an Arabic screen even though every key is translated.
 */
describe('no rule falls back to a sentence of its own', () => {
  const cases: [string, z.ZodTypeAny, unknown][] = [
    ['level: empty code', levelCreateSchema, { stage: 'PRIMAIRE', nameFr: 'Première' }],
    ['level: code too long', levelCreateSchema, { stage: 'PRIMAIRE', nameFr: 'Première', code: 'A'.repeat(21) }],
    ['level: code with a space', levelCreateSchema, { stage: 'PRIMAIRE', nameFr: 'Première', code: 'A B' }],
    ['firstName: one letter', studentCreateSchema, { firstName: 'A', lastName: 'Benali' }],
    ['firstName: too long', studentCreateSchema, { firstName: 'A'.repeat(81), lastName: 'Benali' }],
    ['firstName: digits', studentCreateSchema, { firstName: '1234', lastName: 'Benali' }],
    ['firstName: missing', studentCreateSchema, { lastName: 'Benali' }],
    ['lastName: missing', studentCreateSchema, { firstName: 'Amine' }],
    ['birthDate: bad shape', studentCreateSchema, { firstName: 'Amine', lastName: 'Benali', birthDate: '31/02/2020' }],
    ['birthDate: impossible day', studentCreateSchema, { firstName: 'Amine', lastName: 'Benali', birthDate: '2026-02-31' }],
    ['birthDate: newborn', studentCreateSchema, { firstName: 'Amine', lastName: 'Benali', birthDate: String(new Date().getUTCFullYear()) }],
    ['birthDate: year only', studentCreateSchema, { firstName: 'Amine', lastName: 'Benali', birthDate: '2020' }],
    ['isoDate: not a date', isoDateSchema, 'yesterday'],
    ['isoDate: impossible day', isoDateSchema, '2026-02-31'],
    ['phone: too short', phoneSchema, '12345'],
    ['phone: too long', phoneSchema, '1'.repeat(26)],
    ['phone: letters', phoneSchema, 'abcdef'],
    ['email: too short', studentCreateSchema, { firstName: 'Amine', lastName: 'Benali', email: 'a@b' }],
    ['email: not an email', studentCreateSchema, { firstName: 'Amine', lastName: 'Benali', email: 'nope' }],
    ['cin: wrong shape', studentCreateSchema, { firstName: 'Amine', lastName: 'Benali', cin: '1234567' }],
    ['address: too long', studentCreateSchema, { firstName: 'Amine', lastName: 'Benali', address: 'x'.repeat(201) }],
    ['nameAr: too long', studentCreateSchema, { firstName: 'Amine', lastName: 'Benali', lastNameAr: 'x'.repeat(81) }],
    ['gender: not a member', studentCreateSchema, { firstName: 'Amine', lastName: 'Benali', gender: 'X' }],
    ['status: not a member', studentCreateSchema, { firstName: 'Amine', lastName: 'Benali', status: 'NOPE' }],
    ['parent: bad first name', parentCreateSchema, { firstName: '9', lastName: 'Benali' }],
    ['teacher: bad last name', teacherCreateSchema, { firstName: 'Amine', lastName: '!' }],
    ['level: stage not a member', levelCreateSchema, { code: 'P1', stage: 'NOPE', nameFr: 'Première' }],
    ['level: short name', levelCreateSchema, { code: 'P1', stage: 'PRIMAIRE', nameFr: 'P' }],
    ['subject: short name', subjectCreateSchema, { code: 'MATH', nameFr: 'M' }],
    ['service: short name', serviceCreateSchema, { code: 'SVC', nameFr: 'S' }],
    ['room: empty name', roomCreateSchema, { name: '' }],
    ['room: capacity not a number', roomCreateSchema, { name: 'Salle 1', capacity: 'beaucoup' }],
    ['room: negative capacity', roomCreateSchema, { name: 'Salle 1', capacity: '-3' }],
    ['room: fractional capacity', roomCreateSchema, { name: 'Salle 1', capacity: '2.5' }],
    ['room: status not a member', roomCreateSchema, { name: 'Salle 1', status: 'NOPE' }],
    ['level: sort order not a number', levelCreateSchema, { code: 'P1', stage: 'PRIMAIRE', nameFr: 'Première', sortOrder: 'beaucoup' }],
    ['money: not a number', moneySchema, 'abc'],
    ['money: negative', moneySchema, '-1'],
    ['money: too high', moneySchema, '10000000'],
    ['password: too short', passwordSchema, 'Ab1'],
    ['password: no letter', passwordSchema, '12345678'],
    ['password: no digit', passwordSchema, 'abcdefgh'],
    ['colour: wrong shape', hexColorSchema, 'red'],
  ];

  it.each(cases)('%s reports a key, never a sentence', (_label, schema, input) => {
    const messages = messagesFor(schema, input);
    expect(messages.length, 'the case should have produced at least one issue').toBeGreaterThan(0);
    for (const message of messages) {
      expect(message, 'not a validation key').toMatch(new RegExp(`^${VALIDATION_PREFIX}`));
    }
  });

  it.each(cases)('%s resolves to Arabic text', (_label, schema, input) => {
    for (const message of messagesFor(schema, input)) {
      expect(resolveValidationMessage(message, arabicMessages)).toMatch(/[\u0600-\u06FF]/);
    }
  });
});

/**
 * The schemas themselves must not carry prose: a French literal re-introduced in
 * a rule would compile, pass every dictionary test, and still leak.
 */
describe('the validation sources hold no sentence of their own', () => {
  const SRC = path.join(process.cwd(), 'src');

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(full) ? [full] : [];
    });
  }

  const MESSAGE_CALL = /\.(min|max|length|email|regex|refine|int)\(\s*(?:[^,()]*,\s*)?'([^']+)'/g;
  const ADD_ISSUE = /addIssue\(\{[^}]*message:\s*'([^']+)'/g;

  it('uses vmsg() for every message it declares', () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles(path.join(SRC, 'lib/validation')), path.join(SRC, 'actions/auth.ts')]) {
      const source = fs.readFileSync(file, 'utf8');
      for (const pattern of [MESSAGE_CALL, ADD_ISSUE]) {
        for (const match of source.matchAll(pattern)) {
          if (!match[1]?.startsWith(VALIDATION_PREFIX)) {
            offenders.push(`${match[1]} in ${path.relative(SRC, file)}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses every key it declares at least once', () => {
    // Catches a key added to both dictionaries but wired to nothing, which is
    // how a rule silently keeps Zod's English default.
    const source = sourceFiles(path.join(SRC, 'lib/validation'))
      .concat(path.join(SRC, 'actions/auth.ts'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    const unused = KEYS.filter((key) => !source.includes(`vmsg('${key}')`));
    expect(unused).toEqual([]);
  });
});

describe('the Arabic dictionary keeps no French validation text', () => {
  it('has as many validation keys as French', () => {
    expect(Object.keys(ar.validation)).toEqual(Object.keys(fr.validation));
  });
});